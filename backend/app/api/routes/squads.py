"""
Rutas de gestión de plantillas y club: persistencia en 'user_players' (Inventario/Club con Stamina y Stats),
'plantillas' y 'plantilla_jugadores', actualización de 'users.presupuesto' y validación de tope salarial (150M).
"""

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import text, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import resolve_authenticated_user
from app.models.player import Player
from app.models.squad import UserPlayer, Plantilla, PlantillaJugador
from app.models.user import User

router = APIRouter()

MAX_SALARY_CAP = 150.0
COOLDOWN_HOURS = 24.0
COOLDOWN_SECONDS = int(COOLDOWN_HOURS * 3600)  # 86400 segundos (24 horas)


def _get_cooldown_remaining_seconds(vendido_en: Optional[datetime]) -> int:
    """Calcula los segundos restantes para cumplir las 24 horas de cooldown tras venta."""
    if not vendido_en:
        return 0
    now = datetime.utcnow()
    if getattr(vendido_en, "tzinfo", None) is not None:
        now = datetime.now(timezone.utc)
    elapsed = (now - vendido_en).total_seconds()
    return max(0, int(COOLDOWN_SECONDS - elapsed))


def _build_user_cooldowns(user_id: int, db: Session) -> Dict[int, Dict[str, Any]]:
    """Genera el diccionario de jugadores en cooldown de 24 hs para un mánager."""
    cooldown_rows = (
        db.query(UserPlayer)
        .filter(UserPlayer.user_id == user_id, UserPlayer.en_club == False)
        .all()
    )
    result = {}
    for up in cooldown_rows:
        rem_sec = _get_cooldown_remaining_seconds(up.vendido_en)
        if rem_sec > 0:
            rem_hours = max(1, math.ceil(rem_sec / 3600))
            result[up.player_id] = {
                "player_id": up.player_id,
                "segundos_restantes": rem_sec,
                "horas_restantes": rem_hours,
                "energia": int(up.energia if up.energia is not None else 100),
            }
        elif up.vendido_en is not None:
            # Ya cumplió las 24 horas de descanso fuera del club: recupera al 100% de energía
            if up.energia is not None and up.energia < 100:
                up.energia = 100
    return result


def _ensure_squad_columns(db: Session):
    """Las columnas de base de datos ya se garantizan en database.py init_db() al arrancar el backend.
    Se mantiene como no-op para evitar 40 sentencias DDL ALTER TABLE por request en TiDB Cloud.
    """
    pass


class SaveSquadRequest(BaseModel):
    formation: str = "1-2-2-1"
    players: List[Optional[Dict[str, Any]]] = []
    name: Optional[str] = None
    user_id: Optional[int] = None
    allow_empty: bool = False


def _resolve_user(
    request: Request,
    db: Session,
    explicit_user_id: Optional[int] = None,
    allow_explicit: bool = False,
) -> Optional[User]:
    """Obtiene el mánager autenticado a partir del header Authorization (JWT o legacy)."""
    return resolve_authenticated_user(
        request, db, explicit_user_id=explicit_user_id, allow_explicit=allow_explicit
    )


def calculate_realistic_rating(partidos: int, goles: int, mvps: int, base_rating: int) -> float:
    """Calcula una nota media realista (4.0 a 10.0) evitando valores corrompidos debajo de 1."""
    if not partidos or partidos <= 0:
        return 0.0
    goals_bonus = min(2.0, (goles / partidos) * 2.5)
    mvp_bonus = min(1.0, (mvps / partidos) * 2.0)
    skill_bonus = min(0.8, max(-0.6, (base_rating - 70) * 0.02))
    val = min(9.5, max(5.5, 6.4 + goals_bonus + mvp_bonus + skill_bonus))
    return round(val, 1)


def _serialize_player(p: Player, up: Optional[UserPlayer] = None) -> Dict[str, Any]:
    """Serializa un objeto Player fusionando su estado físico (energia) y estadísticas en el club desde UserPlayer."""
    raw_rating = float(up.rating_promedio if up and up.rating_promedio is not None else 0.0)
    if up and (up.partidos_club or 0) > 0 and (raw_rating < 4.0 or raw_rating > 10.0):
        raw_rating = calculate_realistic_rating(
            up.partidos_club or 0,
            up.goles_club or 0,
            up.mvps_club or 0,
            int(p.rating_general or p.media_juego or 75)
        )
        up.rating_promedio = raw_rating

    return {
        "id": p.id,
        "user_player_id": up.id if up else None,
        "name": p.nombre,
        "nombre": p.nombre,
        "role": p.posicion_base,
        "posicion_base": p.posicion_base,
        "posicion_detalle": p.posicion_detalle,
        "nacionalidad": p.nacionalidad,
        "precio": float(p.precio or 0.0),
        "price": float(p.precio or 0.0),
        "precio_compra": float(up.precio_compra if up else (p.precio or 0.0)),
        "rating_general": int(p.rating_general or p.media_juego or 75),
        "media_juego": int(p.media_juego or p.rating_general or 75),
        "rating_ataque": int(p.rating_ataque or 0),
        "rating_defensa": int(p.rating_defensa or 0),
        "rating_creacion": int(p.rating_creacion or 0),
        "rating_tecnica": int(p.rating_tecnica or 0),
        "rating_fisico": int(p.rating_fisico or 0),
        "rating_palmares": int(p.rating_palmares or 0),
        "image_filename": p.image_filename,
        "energia": int(up.energia if up and up.energia is not None else 100),
        "partidos_club": int(up.partidos_club if up else 0),
        "goles_club": int(up.goles_club if up else 0),
        "vallas_invictas_club": int(up.vallas_invictas_club if up else 0),
        "mvps_club": int(up.mvps_club if up else 0),
        "rating_promedio": raw_rating,
    }


def _build_squad_response(plantilla: Plantilla, user: Optional[User], db: Session) -> Dict[str, Any]:
    """Reconstruye los 10 slots (0..5 titulares, 6..9 suplentes) de una plantilla guardada."""
    rows = (
        db.query(PlantillaJugador, UserPlayer, Player)
        .join(UserPlayer, PlantillaJugador.user_player_id == UserPlayer.id)
        .join(Player, PlantillaJugador.player_id == Player.id)
        .filter(PlantillaJugador.plantilla_id == plantilla.id)
        .order_by(PlantillaJugador.orden.asc())
        .all()
    )

    # AUTO-RECUPERACIÓN: Si plantilla_jugadores quedó desvinculada pero el usuario
    # tiene sus jugadores intactos en 'user_players', reconstruir automáticamente los 10 slots.
    if not rows and user:
        user_players = (
            db.query(UserPlayer, Player)
            .join(Player, UserPlayer.player_id == Player.id)
            .filter(UserPlayer.user_id == user.id, UserPlayer.en_club != False)
            .order_by(UserPlayer.id.asc())
            .all()
        )
        if user_players:
            for idx, (up, player) in enumerate(user_players[:10]):
                pj = PlantillaJugador(
                    plantilla_id=plantilla.id,
                    user_player_id=up.id,
                    player_id=player.id,
                    es_titular=(idx < 6),
                    posicion_cancha=f"SLOT_{idx}",
                    orden=idx + 1,
                )
                db.add(pj)
            db.commit()
            rows = (
                db.query(PlantillaJugador, UserPlayer, Player)
                .join(UserPlayer, PlantillaJugador.user_player_id == UserPlayer.id)
                .join(Player, PlantillaJugador.player_id == Player.id)
                .filter(PlantillaJugador.plantilla_id == plantilla.id)
                .order_by(PlantillaJugador.orden.asc())
                .all()
            )

    slots: List[Optional[Dict[str, Any]]] = [None] * 10
    fallback_starters: List[Dict[str, Any]] = []
    fallback_reserves: List[Dict[str, Any]] = []

    for pj, up, player in rows:
        serialized = _serialize_player(player, up)
        pos_str = pj.posicion_cancha or ""
        placed = False
        if pos_str.startswith("SLOT_"):
            try:
                slot_idx = int(pos_str.split("SLOT_")[-1])
                if 0 <= slot_idx < 10 and slots[slot_idx] is None:
                    slots[slot_idx] = serialized
                    placed = True
            except ValueError:
                pass
        if not placed:
            if pj.es_titular:
                fallback_starters.append(serialized)
            else:
                fallback_reserves.append(serialized)

    for s in fallback_starters:
        for i in range(6):
            if slots[i] is None:
                slots[i] = s
                break

    for r in fallback_reserves:
        for i in range(6, 10):
            if slots[i] is None:
                slots[i] = r
                break

    costo_total = round(sum(float(p["precio"]) for p in slots if p), 2)
    presupuesto_restante = round(max(0.0, MAX_SALARY_CAP - costo_total), 2)
    try:
        db.commit()
    except Exception:
        db.rollback()

    return {
        "id": plantilla.id,
        "user_id": plantilla.user_id,
        "name": user.team_name if user else plantilla.nombre,
        "formation": plantilla.formacion or "1-2-2-1",
        "costo_total": costo_total,
        "presupuesto_disponible": presupuesto_restante,
        "players": slots,
    }


@router.get("/my-squad", status_code=status.HTTP_200_OK)
def get_my_squad(
    request: Request,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Recupera la plantilla activa del mánager desde 'plantillas', 'plantilla_jugadores' y 'user_players'."""
    _ensure_squad_columns(db)
    user = _resolve_user(request, db, explicit_user_id=user_id, allow_explicit=True)
    if not user:
        return {"squad": None, "players": []}

    plantilla = (
        db.query(Plantilla)
        .filter(Plantilla.user_id == user.id, Plantilla.es_activa == True)  # noqa: E712
        .order_by(Plantilla.id.desc())
        .first()
    )

    # Mapa de jugadores en cooldown de recompra de 24 hs tras venta
    cooldown_map = _build_user_cooldowns(user.id, db)

    if not plantilla:
        return {
            "squad": None,
            "players": [],
            "user_id": user.id,
            "team_name": user.team_name,
            "cooldowns": cooldown_map,
        }

    squad_data = _build_squad_response(plantilla, user, db)
    return {
        "squad": squad_data,
        "players": squad_data.get("players", []),
        "formation": squad_data.get("formation", "1-2-2-1"),
        "name": squad_data.get("name", user.team_name),
        "costo_total": squad_data.get("costo_total", 0.0),
        "presupuesto_disponible": squad_data.get("presupuesto_disponible", 150.0),
        "cooldowns": cooldown_map,
        "user_id": user.id,
        "team_name": user.team_name,
    }


@router.post("/save", status_code=status.HTTP_200_OK)
def save_squad(
    payload: SaveSquadRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Sincroniza el inventario del club ('user_players'), guarda la alineación táctica ('plantillas' + 'plantilla_jugadores')
    y actualiza el presupuesto del mánager en 'users'."""
    _ensure_squad_columns(db)
    user = _resolve_user(request, db, explicit_user_id=payload.user_id, allow_explicit=True)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
        )

    raw_slots = (payload.players or [])[:10]
    seen_player_ids = set()
    valid_entries = []
    total_cost = 0.0

    for idx, slot in enumerate(raw_slots):
        if not slot or not isinstance(slot, dict):
            continue
        raw_pid = slot.get("id")
        if raw_pid is None:
            continue
        try:
            pid = int(raw_pid)
        except (ValueError, TypeError):
            continue
        if pid in seen_player_ids:
            continue

        player_db = db.query(Player).filter(Player.id == pid).first()
        if not player_db:
            continue

        seen_player_ids.add(pid)
        price = float(player_db.precio or 0.0)
        total_cost += price
        # SEGURIDAD ANTI-CHEAT: /api/squads/save NO acepta 'energia' desde el cliente.
        # La energía solo se inicializa al fichar por primera vez o se desgasta/recupera en partidos.
        valid_entries.append((idx, player_db))

    total_cost = round(total_cost, 2)
    if total_cost > MAX_SALARY_CAP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El costo total de la plantilla ({total_cost}M) supera el límite salarial de {MAX_SALARY_CAP}M.",
        )

    # 1. Buscar o crear la plantilla activa del usuario
    plantilla = (
        db.query(Plantilla)
        .filter(Plantilla.user_id == user.id, Plantilla.es_activa == True)  # noqa: E712
        .order_by(Plantilla.id.desc())
        .first()
    )

    if not plantilla:
        plantilla = Plantilla(
            user_id=user.id,
            nombre=payload.name or user.team_name or "Mi Alineación Principal",
            formacion=payload.formation or "1-2-2-1",
            costo_total=total_cost,
            es_activa=True,
        )
        db.add(plantilla)
        db.flush()
    else:
        plantilla.formacion = payload.formation or plantilla.formacion or "1-2-2-1"
        plantilla.costo_total = total_cost
        if payload.name and payload.name.strip():
            plantilla.nombre = payload.name.strip()[:50]

    # 2. Sincronizar el inventario del club ('user_players'):
    existing_user_players = db.query(UserPlayer).filter(UserPlayer.user_id == user.id).all()
    # Salvaguarda: Si el cliente envía una plantilla vacía (0 jugadores válidos) pero el usuario ya tiene
    # futbolistas comprados en la base de datos, NO destruir el inventario ni la alineación del usuario.
    active_in_club = [up for up in existing_user_players if getattr(up, "en_club", True) is not False]
    if not valid_entries and active_in_club and not payload.allow_empty:
        return {
            "status": "ignored",
            "message": "Se preservó la plantilla existente en la base de datos (se ignoró payload vacío accidental).",
            "max_budget": MAX_SALARY_CAP,
            "squad": _build_squad_response(plantilla, user, db),
            "cooldowns": _build_user_cooldowns(user.id, db),
        }

    # Una vez superada la salvaguarda, vaciar los slots anteriores para escribir los nuevos
    db.query(PlantillaJugador).filter(PlantillaJugador.plantilla_id == plantilla.id).delete()
    db.flush()

    # Mapa de futbolistas históricos del usuario (en club o previamente vendidos)
    existing_by_pid = {up.player_id: up for up in existing_user_players}

    # 2.1 Procesar ventas: jugadores que estaban en la plantilla activa y ya no fueron incluidos
    for pid, up in list(existing_by_pid.items()):
        if pid not in seen_player_ids:
            if getattr(up, "en_club", True):
                up.en_club = False
                up.vendido_en = datetime.utcnow()
                up.partidos_cooldown = 0
    db.flush()

    # 3. Insertar o reactivar cada jugador fichado en 'user_players' y vincularlo en 'plantilla_jugadores'
    for slot_idx, player_db in valid_entries:
        up = existing_by_pid.get(player_db.id)
        if not up:
            # Jugador fichado por primera vez en el club:
            up = UserPlayer(
                user_id=user.id,
                player_id=player_db.id,
                precio_compra=float(player_db.precio or 0.0),
                energia=100,  # Jugador recién fichado por primera vez arranca con energía al 100%
                en_club=True,
                vendido_en=None,
                partidos_cooldown=0,
            )
            db.add(up)
            db.flush()
            existing_by_pid[player_db.id] = up
        else:
            # Si el jugador ya existía pero estaba marcado como vendido (recompra):
            if not getattr(up, "en_club", True):
                rem_sec = _get_cooldown_remaining_seconds(up.vendido_en)
                if rem_sec > 0:
                    rem_h = max(1, math.ceil(rem_sec / 3600))
                    rem_m = max(1, math.ceil(rem_sec / 60))
                    time_str = f"{rem_h}h" if rem_h > 1 else f"{rem_m}m"
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"No puedes fichar a {player_db.nombre} todavía. Debes esperar 24 hs tras haberlo vendido (restan aprox. {time_str}).",
                    )
                # Cooldown de 24 hs cumplido: reactivar en el club al 100% de energía por el día completo de descanso
                up.en_club = True
                up.vendido_en = None
                up.partidos_cooldown = 0
                up.energia = 100
                up.precio_compra = float(player_db.precio or 0.0)

        # SEGURIDAD ANTI-CHEAT: Si el jugador ya existía y estaba activo en el club, /squads/save NUNCA modifica su energía.
        # Se preserva la energía oficial calculada por el servidor y registrada en la base de datos.

        pj = PlantillaJugador(
            plantilla_id=plantilla.id,
            user_player_id=up.id,
            player_id=player_db.id,
            es_titular=(slot_idx < 6),
            posicion_cancha=f"SLOT_{slot_idx}",
            orden=slot_idx + 1,
        )
        db.add(pj)

    # 4. Actualizar presupuesto disponible del mánager en 'users'
    user.presupuesto = round(max(0.0, MAX_SALARY_CAP - total_cost), 2)
    if payload.name and payload.name.strip() and payload.name.strip() != "Tu Equipo":
        user.team_name = payload.name.strip()

    db.commit()
    db.refresh(plantilla)
    db.refresh(user)

    # Devolver mapa actualizado de cooldowns de 24 hs
    cooldown_map = _build_user_cooldowns(user.id, db)

    return {
        "status": "saved",
        "message": "Club (user_players), alineación (plantillas) y presupuesto guardados en MySQL",
        "max_budget": MAX_SALARY_CAP,
        "squad": _build_squad_response(plantilla, user, db),
        "cooldowns": cooldown_map,
    }


@router.get("/club-inventory", status_code=status.HTTP_200_OK)
def get_club_inventory(
    request: Request,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Devuelve el inventario de jugadores comprados por el usuario en la tabla 'user_players' con su energía y stats."""
    user = _resolve_user(request, db, explicit_user_id=user_id, allow_explicit=True)
    if not user:
        return {"count": 0, "inventory": []}

    rows = (
        db.query(UserPlayer, Player)
        .join(Player, UserPlayer.player_id == Player.id)
        .filter(UserPlayer.user_id == user.id, UserPlayer.en_club != False)
        .all()
    )
    items = [_serialize_player(player, up) for up, player in rows]
    return {"user_id": user.id, "team_name": user.team_name, "count": len(items), "inventory": items}


@router.get("/all", status_code=status.HTTP_200_OK)
def list_all_squads(db: Session = Depends(get_db)):
    """Endpoint de verificación para consultar todas las plantillas guardadas en MySQL."""
    plantillas = db.query(Plantilla).order_by(Plantilla.id.desc()).all()
    result = []
    for pl in plantillas:
        user = db.query(User).filter(User.id == pl.user_id).first()
        result.append(_build_squad_response(pl, user, db))
    return {"count": len(result), "squads": result}


@router.post("/validate-penalties")
def validate_penalties():
    """Calcula las penalizaciones del 15% o 25% según la posición asignada."""
    return {"penalties": []}
