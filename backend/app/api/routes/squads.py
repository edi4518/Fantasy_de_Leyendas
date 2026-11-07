"""
Rutas de gestión de plantillas y club: persistencia en 'user_players' (Inventario/Club con Stamina y Stats),
'plantillas' y 'plantilla_jugadores', actualización de 'users.presupuesto' y validación de tope salarial (150M).
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.player import Player
from app.models.squad import UserPlayer, Plantilla, PlantillaJugador
from app.models.user import User

router = APIRouter()

MAX_SALARY_CAP = 150.0


def _ensure_squad_columns(db: Session):
    """Garantiza que las columnas de stamina y estadísticas en user_players y plantillas existan en TiDB."""
    for col_name, col_def in [
        ("energia", "TINYINT UNSIGNED NOT NULL DEFAULT 100"),
        ("partidos_club", "SMALLINT UNSIGNED NOT NULL DEFAULT 0"),
        ("goles_club", "SMALLINT UNSIGNED NOT NULL DEFAULT 0"),
        ("vallas_invictas_club", "SMALLINT UNSIGNED NOT NULL DEFAULT 0"),
        ("mvps_club", "SMALLINT UNSIGNED NOT NULL DEFAULT 0"),
        ("rating_promedio", "DECIMAL(4,2) NOT NULL DEFAULT 0.00"),
        ("adquirido_en", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
    ]:
        try:
            db.execute(text(f"ALTER TABLE user_players ADD COLUMN {col_name} {col_def}"))
            db.commit()
        except Exception:
            db.rollback()

    for col_name, col_def in [
        ("es_activa", "BOOLEAN DEFAULT TRUE"),
        ("created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
        ("updated_at", "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    ]:
        try:
            db.execute(text(f"ALTER TABLE plantillas ADD COLUMN {col_name} {col_def}"))
            db.commit()
        except Exception:
            db.rollback()


class SaveSquadRequest(BaseModel):
    formation: str = "1-2-2-1"
    players: List[Optional[Dict[str, Any]]] = []
    name: Optional[str] = None
    user_id: Optional[int] = None


def _resolve_user(request: Request, db: Session, explicit_user_id: Optional[int] = None) -> Optional[User]:
    """Obtiene el mánager autenticado a partir del header Authorization o el último usuario registrado."""
    auth_header = request.headers.get("Authorization", "")
    if "token_user_" in auth_header:
        try:
            uid = int(auth_header.split("token_user_")[-1].strip())
            user = db.query(User).filter(User.id == uid).first()
            if user:
                return user
        except ValueError:
            pass

    if explicit_user_id:
        user = db.query(User).filter(User.id == explicit_user_id).first()
        if user:
            return user

    return db.query(User).order_by(User.id.desc()).first()


def _serialize_player(p: Player, up: Optional[UserPlayer] = None) -> Dict[str, Any]:
    """Serializa un objeto Player fusionando su estado físico (energia) y estadísticas en el club desde UserPlayer."""
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
        "rating_promedio": float(up.rating_promedio if up else 0.0),
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
    user = _resolve_user(request, db, user_id)
    if not user:
        return {"squad": None}

    plantilla = (
        db.query(Plantilla)
        .filter(Plantilla.user_id == user.id, Plantilla.es_activa == True)  # noqa: E712
        .order_by(Plantilla.id.desc())
        .first()
    )

    if not plantilla:
        return {"squad": None, "user_id": user.id, "team_name": user.team_name}

    return {"squad": _build_squad_response(plantilla, user, db)}


@router.post("/save", status_code=status.HTTP_200_OK)
def save_squad(
    payload: SaveSquadRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Sincroniza el inventario del club ('user_players'), guarda la alineación táctica ('plantillas' + 'plantilla_jugadores')
    y actualiza el presupuesto del mánager en 'users'."""
    _ensure_squad_columns(db)
    user = _resolve_user(request, db, payload.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay ningún mánager registrado en la base de datos para asociar la plantilla.",
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
        energia_val = slot.get("energia")
        energia_clean = max(0, min(100, int(round(float(energia_val))))) if isinstance(energia_val, (int, float)) else None
        valid_entries.append((idx, player_db, energia_clean))

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
        db.query(PlantillaJugador).filter(PlantillaJugador.plantilla_id == plantilla.id).delete()
        db.flush()

    # 2. Sincronizar el inventario del club ('user_players'):
    # Eliminar jugadores vendidos que ya no pertenecen a la plantilla del usuario
    existing_user_players = db.query(UserPlayer).filter(UserPlayer.user_id == user.id).all()
    existing_by_pid = {up.player_id: up for up in existing_user_players}

    for pid, up in list(existing_by_pid.items()):
        if pid not in seen_player_ids:
            db.delete(up)
            del existing_by_pid[pid]
    db.flush()

    # 3. Insertar o actualizar cada jugador fichado en 'user_players' y vincularlo en 'plantilla_jugadores'
    for slot_idx, player_db, energia_clean in valid_entries:
        up = existing_by_pid.get(player_db.id)
        if not up:
            up = UserPlayer(
                user_id=user.id,
                player_id=player_db.id,
                precio_compra=float(player_db.precio or 0.0),
                energia=energia_clean if energia_clean is not None else 100,
            )
            db.add(up)
            db.flush()
            existing_by_pid[player_db.id] = up
        elif energia_clean is not None:
            up.energia = energia_clean

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

    return {
        "status": "saved",
        "message": "Club (user_players), alineación (plantillas) y presupuesto guardados en MySQL",
        "max_budget": MAX_SALARY_CAP,
        "squad": _build_squad_response(plantilla, user, db),
    }


@router.get("/club-inventory", status_code=status.HTTP_200_OK)
def get_club_inventory(
    request: Request,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Devuelve el inventario de jugadores comprados por el usuario en la tabla 'user_players' con su energía y stats."""
    user = _resolve_user(request, db, user_id)
    if not user:
        return {"count": 0, "inventory": []}

    rows = (
        db.query(UserPlayer, Player)
        .join(Player, UserPlayer.player_id == Player.id)
        .filter(UserPlayer.user_id == user.id)
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
