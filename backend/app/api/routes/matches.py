"""
Rutas de simulación e historial de partidos en MySQL (tablas 'partidos' y 'eventos_partido').
Persiste formaciones, MVP del encuentro, estadísticas cara a cara (posesión, tiros, atajadas, tarjetas),
timeline de eventos con equipo ('local'/'visitante'), récords competitivos en 'users' y rendimiento en 'user_players'.
"""

import json
import os
import random
import threading
import time
from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import resolve_authenticated_user
from app.api.routes.ranking import get_user_rank, invalidate_leaderboard_cache
from app.models.match import EventoPartido, Partido
from app.models.player import Player
from app.models.squad import Plantilla, UserPlayer
from app.models.user import User
from app.services.simulation_service import SimulationService

router = APIRouter()
simulation_service = SimulationService()

# Carga de equipos CPU
CPU_TEAMS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "seed", "cpu_teams.json"
)
CPU_TEAMS: List[Dict[str, Any]] = []

if os.path.exists(CPU_TEAMS_PATH):
    try:
        with open(CPU_TEAMS_PATH, "r", encoding="utf-8") as f:
            CPU_TEAMS = json.load(f)
    except Exception as e:
        print(f"[Matches API] Error cargando cpu_teams.json: {e}")

MATCH_HISTORY_CACHE: List[Dict[str, Any]] = []


class SimulateRequest(BaseModel):
    home_squad: Optional[Dict[str, Any]] = None
    away_squad: Optional[Dict[str, Any]] = None
    user_id: Optional[int] = None


class RecordMatchRequest(BaseModel):
    rival_name: str = "Leyendas Rival"
    home_score: int = 0
    away_score: int = 0
    formation: Optional[str] = "1-2-2-1"
    away_formation: Optional[str] = "1-2-2-1"
    events: Optional[List[Dict[str, Any]]] = None
    stats: Optional[Dict[str, Any]] = None
    mvp: Optional[Dict[str, Any]] = None
    squad_players: Optional[List[Optional[Dict[str, Any]]]] = None
    player_stats: Optional[Dict[str, Any]] = None
    user_id: Optional[int] = None
    rival_user_id: Optional[int] = None


class SimpleRateLimiter:
    """Rate limiter en memoria thread-safe con ventana de enfriamiento y limpieza periódica."""

    def __init__(self, cooldown_seconds: float = 6.0, max_entries: int = 5000):
        self.cooldown_seconds = cooldown_seconds
        self.max_entries = max_entries
        self.records: Dict[str, float] = {}
        self.lock = threading.Lock()

    def check_and_update(self, key: str) -> Tuple[bool, float]:
        now = time.time()
        with self.lock:
            if len(self.records) > self.max_entries:
                cutoff = now - 3600.0
                self.records = {k: v for k, v in self.records.items() if v > cutoff}

            last_time = self.records.get(key, 0.0)
            elapsed = now - last_time
            if elapsed < self.cooldown_seconds:
                remaining = self.cooldown_seconds - elapsed
                return False, remaining

            self.records[key] = now
            return True, 0.0


# Instancias globales de protección anti-spam / anti-farming
_MATCH_RECORD_LIMITER = SimpleRateLimiter(cooldown_seconds=6.0)
_MATCH_SIMULATE_LIMITER = SimpleRateLimiter(cooldown_seconds=3.0)


def _get_client_identifier(request: Request, user: Optional[User] = None) -> str:
    """Genera un identificador único por usuario autenticado o IP de cliente."""
    if user and user.id:
        return f"user_{user.id}"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
        return f"ip_{client_ip}"
    if request.client and request.client.host:
        return f"ip_{request.client.host}"
    return "ip_unknown"


def _resolve_user(
    request: Request,
    db: Session,
    explicit_user_id: Optional[int] = None,
    allow_explicit: bool = False,
) -> Optional[User]:
    return resolve_authenticated_user(
        request, db, explicit_user_id=explicit_user_id, allow_explicit=allow_explicit
    )


def _normalize_event_type(raw_type: str) -> str:
    t = (raw_type or "").lower().strip()
    mapping = {
        "goal": "GOL",
        "penalty-goal": "GOL",
        "save": "PARADA",
        "post": "DISPARO_POSTE",
        "crossbar": "DISPARO_POSTE",
        "foul": "FALTA",
        "freekick": "FALTA",
        "yellow-card": "TARJETA_AMARILLA",
        "red-card": "TARJETA_ROJA",
        "substitution": "CAMBIO",
    }
    return mapping.get(t, t.upper()[:50] or "EVENTO")


def _get_random_cpu_squad() -> Dict[str, Any]:
    if not CPU_TEAMS:
        return {
            "name": "Equipo Rival",
            "formation": "1-1-3-1",
            "players": [
                {"name": "Buffon", "role": "POR", "rating_general": 88, "rating_defensa": 30, "rating_fisico": 80, "rating_palmares": 85},
                {"name": "Beckenbauer", "role": "DEF", "rating_general": 90, "rating_defensa": 92, "rating_fisico": 85, "rating_palmares": 95},
                {"name": "Maradona", "role": "MC", "rating_general": 95, "rating_creacion": 98, "rating_tecnica": 99, "rating_fisico": 78, "rating_palmares": 98},
                {"name": "Cruyff", "role": "MC", "rating_general": 93, "rating_creacion": 95, "rating_tecnica": 96, "rating_fisico": 82, "rating_palmares": 95},
                {"name": "Pirlo", "role": "MC", "rating_general": 89, "rating_creacion": 94, "rating_tecnica": 93, "rating_fisico": 75, "rating_palmares": 90},
                {"name": "Pelé", "role": "DEL", "rating_general": 97, "rating_ataque": 98, "rating_tecnica": 97, "rating_fisico": 88, "rating_palmares": 99},
            ],
        }
    team = random.choice(CPU_TEAMS)
    return {
        "name": team["nombre_equipo"],
        "formation": team["formacion"],
        "players": [
            {
                "name": j["nombre"],
                "role": j.get("role") or j.get("posicion_base") or "MC",
                "posicion_base": j.get("posicion_base") or j.get("role") or "MC",
                "rating_general": j.get("media_juego") or j.get("rating_general") or 75,
                "rating_ataque": j.get("rating_ataque") or 70,
                "rating_defensa": j.get("rating_defensa") or 70,
                "rating_creacion": j.get("rating_creacion") or 70,
                "rating_tecnica": j.get("rating_tecnica") or 70,
                "rating_fisico": j.get("rating_fisico") or 80,
                "rating_palmares": j.get("rating_palmares") or 70,
            }
            for j in team.get("jugadores", [])
        ],
    }


@router.post("/record")
def record_finished_match(
    payload: RecordMatchRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Guarda en MySQL ('partidos', 'eventos_partido', 'users' y 'user_players') toda la información de un partido finalizado."""
    # 1. Seguridad: Verificar autenticación del usuario mediante Bearer token
    user = _resolve_user(request, db, allow_explicit=False)

    # 2. Protección Anti-Spam / Rate Limiting (mínimo 6s entre registros de partidos)
    rate_key = _get_client_identifier(request, user)
    allowed, remaining = _MATCH_RECORD_LIMITER.check_and_update(rate_key)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Anti-spam activo: espera {round(remaining, 1)}s antes de registrar otro partido.",
        )

    if not user:
        return {"status": "skipped", "reason": "No autenticado"}

    home_score = int(payload.home_score or 0)
    away_score = int(payload.away_score or 0)

    # 3. Validación de integridad de marcadores (rango permitido 0 a 30 goles)
    if home_score < 0 or away_score < 0 or home_score > 30 or away_score > 30:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Marcador fuera de los límites permitidos (0-30 goles).",
        )

    if home_score > away_score:
        res_enum = "local"
        res_label = "VICTORIA"
        elo_var_local = 25
        elo_var_visitante = -15
    elif home_score == away_score:
        res_enum = "empate"
        res_label = "EMPATE"
        elo_var_local = 5
        elo_var_visitante = 5
    else:
        res_enum = "visitante"
        res_label = "DERROTA"
        elo_var_local = -15
        elo_var_visitante = 25

    # 1. Resolver o crear plantilla activa del usuario
    plantilla = (
        db.query(Plantilla)
        .filter(Plantilla.user_id == user.id)
        .order_by(Plantilla.id.desc())
        .first()
    )
    if not plantilla:
        plantilla = Plantilla(
            user_id=user.id,
            nombre=user.team_name or "Mi Alineación Principal",
            formacion=payload.formation or "1-2-2-1",
            costo_total=0.0,
            es_activa=True,
        )
        db.add(plantilla)
        db.flush()

    # 2. Extraer métricas cara a cara y MVP
    events_list = payload.events or []
    stats_obj = payload.stats or {}
    mvp_obj = payload.mvp or {}

    pos_home = int(stats_obj.get("homePossession") or stats_obj.get("possessionHome") or 50)
    pos_away = max(0, 100 - pos_home)

    home_saves = sum(1 for e in events_list if e.get("side") == "home" and e.get("type") == "save")
    away_saves = sum(1 for e in events_list if e.get("side") == "away" and e.get("type") == "save")
    home_yellows = sum(1 for e in events_list if e.get("side") == "home" and e.get("type") == "yellow-card")
    away_yellows = sum(1 for e in events_list if e.get("side") == "away" and e.get("type") == "yellow-card")
    home_reds = sum(1 for e in events_list if e.get("side") == "home" and e.get("type") == "red-card")
    away_reds = sum(1 for e in events_list if e.get("side") == "away" and e.get("type") == "red-card")

    tiros_local = int(stats_obj.get("homeShots") or stats_obj.get("shotsHome") or (home_score + away_saves + 2))
    tiros_visitante = int(stats_obj.get("awayShots") or stats_obj.get("shotsAway") or (away_score + home_saves + 2))

    mvp_name = mvp_obj.get("name")
    mvp_role = mvp_obj.get("role")
    mvp_rating = float(mvp_obj.get("matchRating")) if mvp_obj.get("matchRating") is not None else None
    mvp_side = "visitante" if mvp_obj.get("isRival") else "local"

    # 3. Crear registro en 'partidos'
    partido = Partido(
        local_user_id=user.id,
        visitante_user_id=None,
        nombre_visitante_ia=payload.rival_name or "Leyendas Rival",
        plantilla_local_id=plantilla.id,
        plantilla_visitante_id=None,
        formacion_local=(payload.formation or plantilla.formacion or "1-2-2-1")[:10],
        formacion_visitante=(payload.away_formation or "1-2-2-1")[:10],
        goles_local=home_score,
        goles_visitante=away_score,
        resultado=res_enum,
        variacion_elo_local=elo_var_local,
        variacion_elo_visitante=elo_var_visitante,
        mvp_nombre=mvp_name,
        mvp_rol=mvp_role,
        mvp_rating=mvp_rating,
        mvp_equipo=mvp_side,
        posesion_local=pos_home,
        posesion_visitante=pos_away,
        tiros_local=tiros_local,
        tiros_visitante=tiros_visitante,
        atajadas_local=home_saves,
        atajadas_visitante=away_saves,
        amarillas_local=home_yellows,
        amarillas_visitante=away_yellows,
        rojas_local=home_reds,
        rojas_visitante=away_reds,
    )
    db.add(partido)
    db.flush()

    # 4. Insertar timeline en 'eventos_partido'
    all_players = db.query(Player.id, Player.nombre).all()
    player_id_by_name = {p.nombre.lower(): p.id for p in all_players if p.nombre}

    for ev in events_list:
        minute = max(0, min(120, int(ev.get("minute") or ev.get("minuto") or 0)))
        second = max(0, min(59, int(ev.get("second") or ev.get("segundo") or 0)))
        ev_type = _normalize_event_type(str(ev.get("type") or ev.get("tipo") or "EVENTO"))
        side = "visitante" if ev.get("side") == "away" else "local"
        p_name = str(ev.get("player") or "").strip()
        detail = str(ev.get("detail") or ev.get("description") or ev.get("text") or "").strip()
        desc = f"{p_name} - {detail}".strip(" -") or ev_type

        matched_pid = player_id_by_name.get(p_name.lower()) if p_name else None
        db.add(
            EventoPartido(
                partido_id=partido.id,
                minuto=minute,
                segundo=second,
                tipo=ev_type,
                descripcion=desc[:255],
                equipo=side,
                player_id=matched_pid,
                jugador_nombre=p_name[:120] if p_name else None,
            )
        )

    # 5. Actualizar récord competitivo y ELO del mánager en 'users' (respetando 0 sin resetear a 1000)
    current_elo = user.elo_rating if user.elo_rating is not None else 1000
    user.elo_rating = max(0, current_elo + elo_var_local)
    user.partidos_jugados = (user.partidos_jugados or 0) + 1
    if res_enum == "local":
        user.victorias = (user.victorias or 0) + 1
    elif res_enum == "empate":
        user.empates = (user.empates or 0) + 1
    else:
        user.derrotas = (user.derrotas or 0) + 1
    user.goles_favor = (user.goles_favor or 0) + home_score
    user.goles_contra = (user.goles_contra or 0) + away_score

    # Actualizar récord del rival si es un usuario real registrado
    if payload.rival_user_id:
        rival_user = db.query(User).filter(User.id == payload.rival_user_id).first()
        if rival_user:
            partido.visitante_user_id = rival_user.id
            current_rival_elo = rival_user.elo_rating if rival_user.elo_rating is not None else 1000
            rival_user.elo_rating = max(0, current_rival_elo + elo_var_visitante)
            rival_user.partidos_jugados = (rival_user.partidos_jugados or 0) + 1
            if res_enum == "visitante":
                rival_user.victorias = (rival_user.victorias or 0) + 1
            elif res_enum == "empate":
                rival_user.empates = (rival_user.empates or 0) + 1
            else:
                rival_user.derrotas = (rival_user.derrotas or 0) + 1
            rival_user.goles_favor = (rival_user.goles_favor or 0) + away_score
            rival_user.goles_contra = (rival_user.goles_contra or 0) + home_score

    # 6. Actualizar energía (stamina) y estadísticas en el club dentro de 'user_players'
    # SEGURIDAD ANTI-CHEAT ABSOLUTA:
    # La energía es calculada 100% por el servidor a partir del valor previo en la BD.
    # Se ignora cualquier valor de energía que el cliente intente enviar por request.
    user_players = db.query(UserPlayer).filter(UserPlayer.user_id == user.id).all()
    up_by_pid = {up.player_id: up for up in user_players}

    if payload.squad_players:
        for slot_idx, sp in enumerate(payload.squad_players):
            if not sp or not isinstance(sp, dict):
                continue
            pid = sp.get("id")
            if pid and int(pid) in up_by_pid:
                up = up_by_pid[int(pid)]
                current_db_energy = int(up.energia if up.energia is not None else 100)

                # 1. Los 6 titulares (slots 0..5) se desgastan 15% por disputar el partido:
                if slot_idx < 6:
                    up.energia = max(0, current_db_energy - 15)
                # 2. Los 4 suplentes (slots 6..9) en el banquillo recuperan 25% de energía:
                else:
                    up.energia = min(100, current_db_energy + 25)

    if payload.player_stats and isinstance(payload.player_stats, dict):
        for p_key, st in payload.player_stats.items():
            if not isinstance(st, dict):
                continue
            matched_pid = player_id_by_name.get(p_key.lower().strip())
            if matched_pid and matched_pid in up_by_pid:
                up = up_by_pid[matched_pid]
                up.partidos_club = int(st.get("matchesPlayed") or up.partidos_club or 0)
                up.goles_club = int(st.get("goals") or up.goles_club or 0)
                up.vallas_invictas_club = int(st.get("cleanSheets") or up.vallas_invictas_club or 0)
                up.mvps_club = int(st.get("mvpAwards") or up.mvps_club or 0)
                if st.get("avgRating") is not None:
                    try:
                        raw_r = float(st["avgRating"])
                        if 4.0 <= raw_r <= 10.0:
                            up.rating_promedio = raw_r
                        elif (up.partidos_club or 0) > 0:
                            from app.api.routes.squads import calculate_realistic_rating
                            p_obj = db.query(Player).filter(Player.id == matched_pid).first()
                            base_r = int(p_obj.rating_general or p_obj.media_juego or 75) if p_obj else 75
                            up.rating_promedio = calculate_realistic_rating(
                                up.partidos_club or 0,
                                up.goles_club or 0,
                                up.mvps_club or 0,
                                base_r
                            )
                    except (ValueError, TypeError):
                        pass

    db.commit()
    db.refresh(user)
    invalidate_leaderboard_cache()
    current_rank = get_user_rank(db, user.id)

    return {
        "status": "recorded",
        "partido_id": partido.id,
        "user_id": user.id,
        "resultado": res_label,
        "variacion_elo": elo_var_local,
        "nuevo_elo": user.elo_rating,
        "current_rank": current_rank,
        "record": {
            "partidos_jugados": user.partidos_jugados,
            "victorias": user.victorias,
            "empates": user.empates,
            "derrotas": user.derrotas,
        },
    }


@router.post("/simulate")
def simulate_match(
    request: Request,
    req: Optional[SimulateRequest] = None,
    db: Session = Depends(get_db),
):
    """Ejecuta el motor de simulación 6v6 en servidor."""
    # 1. Seguridad: Anti-Spam / Rate Limiting (mínimo 3s entre simulaciones)
    user = _resolve_user(request, db, allow_explicit=False)
    rate_key = _get_client_identifier(request, user)
    allowed, remaining = _MATCH_SIMULATE_LIMITER.check_and_update(rate_key)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Anti-spam activo: espera {round(remaining, 1)}s antes de simular otro partido.",
        )

    payload = req.model_dump() if req else {}
    home_squad = payload.get("home_squad")
    away_squad = payload.get("away_squad")

    if not home_squad or not home_squad.get("players"):
        home_squad = {
            "name": "Tu Equipo",
            "formation": "1-2-2-1",
            "players": [
                {"name": "Casillas", "role": "POR", "rating_general": 89, "rating_defensa": 30, "rating_creacion": 20, "rating_tecnica": 40, "rating_ataque": 10, "rating_fisico": 82, "rating_palmares": 88},
                {"name": "Maldini", "role": "DEF", "rating_general": 92, "rating_defensa": 92, "rating_creacion": 70, "rating_tecnica": 78, "rating_ataque": 40, "rating_fisico": 85, "rating_palmares": 92},
                {"name": "Baresi", "role": "DEF", "rating_general": 90, "rating_defensa": 93, "rating_creacion": 68, "rating_tecnica": 75, "rating_ataque": 35, "rating_fisico": 79, "rating_palmares": 90},
                {"name": "Zidane", "role": "MC", "rating_general": 96, "rating_creacion": 96, "rating_tecnica": 98, "rating_ataque": 88, "rating_defensa": 65, "rating_fisico": 83, "rating_palmares": 95},
                {"name": "Xavi", "role": "MC", "rating_general": 94, "rating_creacion": 97, "rating_tecnica": 95, "rating_ataque": 78, "rating_defensa": 68, "rating_fisico": 76, "rating_palmares": 94},
                {"name": "Messi", "role": "DEL", "rating_general": 99, "rating_ataque": 99, "rating_tecnica": 99, "rating_creacion": 95, "rating_defensa": 35, "rating_fisico": 80, "rating_palmares": 99},
            ],
        }

    if not away_squad or not away_squad.get("players"):
        away_squad = _get_random_cpu_squad()

    sim_result = simulation_service.simulate(home_squad, away_squad)
    home_score = sim_result["home_team"]["score"]
    away_score = sim_result["away_team"]["score"]

    if home_score > away_score:
        res_type = "VICTORIA"
        pts = 25
        elo_var = 25
    elif home_score == away_score:
        res_type = "EMPATE"
        pts = 5
        elo_var = 5
    else:
        res_type = "DERROTA"
        pts = -15
        elo_var = -15

    goal_events = [e for e in sim_result.get("events", []) if e.get("type") == "goal"]
    mvp = goal_events[0]["player"] if goal_events else home_squad["players"][0]["name"]

    sim_result["summary"] = {
        "result_type": res_type,
        "points_gained": pts,
        "elo_variation": elo_var,
        "mvp": mvp,
    }
    return sim_result


@router.get("/opponents")
def get_real_opponents(
    request: Request,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Retorna las plantillas activas de otros usuarios reales registrados en MySQL para Matchmaking P2P."""
    from app.models.squad import PlantillaJugador
    user = _resolve_user(request, db, explicit_user_id=user_id, allow_explicit=True)
    query = (
        db.query(Plantilla)
        .join(User, User.id == Plantilla.user_id)
        .filter(Plantilla.es_activa == True)
    )
    if user:
        query = query.filter(Plantilla.user_id != user.id)

    plantillas = query.order_by(Plantilla.id.desc()).all()
    opponents = []
    for pl in plantillas:
        u = db.query(User).filter(User.id == pl.user_id).first()
        rows = (
            db.query(PlantillaJugador, Player)
            .join(Player, PlantillaJugador.player_id == Player.id)
            .filter(PlantillaJugador.plantilla_id == pl.id)
            .order_by(PlantillaJugador.orden.asc())
            .all()
        )
        players_list = []
        for pj, p in rows:
            players_list.append({
                "id": p.id,
                "name": p.nombre,
                "nombre": p.nombre,
                "role": p.posicion_base,
                "posicion_base": p.posicion_base,
                "rating_general": p.media_juego or p.rating_general or 75,
                "media_juego": p.media_juego or p.rating_general or 75,
                "rating_ataque": p.rating_ataque or 70,
                "rating_defensa": p.rating_defensa or 70,
                "rating_creacion": p.rating_creacion or 70,
                "rating_tecnica": p.rating_tecnica or 70,
                "rating_fisico": p.rating_fisico or 75,
                "rating_palmares": p.rating_palmares or 70,
                "es_titular": pj.es_titular,
                "posicion_cancha": pj.posicion_cancha,
                "precio": float(p.precio or 0.0),
                "image_filename": p.image_filename,
            })

        if len(players_list) >= 6:
            team_label = (u.team_name if u and u.team_name else pl.nombre) or "Equipo Rival"
            manager_label = (
                f"{u.nombre} {u.apellido}".strip()
                if u and (u.nombre or u.apellido)
                else (u.username if u else "Mánager Rival")
            )
            opponents.append({
                "id": pl.id,
                "user_id": u.id if u else None,
                "team_name": team_label,
                "name": team_label,
                "nombre_equipo": team_label,
                "manager_name": manager_label,
                "owner": manager_label,
                "avatar_url": u.photo_url if u else None,
                "photo_url": u.photo_url if u else None,
                "formation": pl.formacion or "1-2-2-1",
                "costo_total": float(pl.costo_total or 0.0),
                "players": players_list,
                "jugadores": players_list,
            })

    return {"count": len(opponents), "opponents": opponents, "teams": opponents}


@router.get("/cpu-opponents")
def get_cpu_opponents(
    request: Request,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Retorna los rivales reales registrados en MySQL para Matchmaking P2P."""
    res = get_real_opponents(request, user_id, db)
    return {"count": res["count"], "teams": res["opponents"]}


@router.get("/history")
def get_match_history(
    request: Request,
    limit: int = Query(15, ge=1, le=50),
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Retorna el historial completo de partidos desde MySQL ('partidos' + 'eventos_partido') listo para el Popup de Historial."""
    try:
        user = _resolve_user(request, db, explicit_user_id=user_id, allow_explicit=True)
        if not user:
            return []
        query = db.query(Partido).filter(Partido.local_user_id == user.id)
        partidos = query.order_by(Partido.id.desc()).limit(limit).all()

        if partidos:
            history_list = []
            for p in partidos:
                eventos = (
                    db.query(EventoPartido)
                    .filter(EventoPartido.partido_id == p.id)
                    .order_by(EventoPartido.minuto.asc(), EventoPartido.id.asc())
                    .all()
                )
                if p.resultado == "local":
                    res_label = "VICTORIA"
                    res_type = "win"
                    pts = p.variacion_elo_local if p.variacion_elo_local is not None else 25
                elif p.resultado == "empate":
                    res_label = "EMPATE"
                    res_type = "draw"
                    pts = p.variacion_elo_local if p.variacion_elo_local is not None else 5
                else:
                    res_label = "DERROTA"
                    res_type = "loss"
                    pts = p.variacion_elo_local if p.variacion_elo_local is not None else -15

                serialized_events = [
                    {
                        "minute": ev.minuto,
                        "second": ev.segundo,
                        "type": "goal" if ev.tipo == "GOL" else (
                            "save" if ev.tipo == "PARADA" else (
                                "yellow-card" if ev.tipo == "TARJETA_AMARILLA" else (
                                    "red-card" if ev.tipo == "TARJETA_ROJA" else (
                                        "substitution" if ev.tipo == "CAMBIO" else ev.tipo.lower()
                                    )
                                )
                            )
                        ),
                        "tipo": ev.tipo,
                        "side": "away" if ev.equipo == "visitante" else "home",
                        "player": ev.jugador_nombre or "",
                        "detail": ev.descripcion,
                    }
                    for ev in eventos
                ]

                history_list.append(
                    {
                        "id": p.id,
                        "rival": p.nombre_visitante_ia or "Leyendas Rival",
                        "opponent": p.nombre_visitante_ia or "Leyendas Rival",
                        "homeScore": p.goles_local,
                        "awayScore": p.goles_visitante,
                        "score": f"{p.goles_local} - {p.goles_visitante}",
                        "resultado": res_label,
                        "resultType": res_type,
                        "points": pts,
                        "elo": p.variacion_elo_local,
                        "homeTeam": {
                            "name": user.team_name if user else "Tu Equipo",
                            "score": p.goles_local,
                            "formation": p.formacion_local,
                        },
                        "awayTeam": {
                            "name": p.nombre_visitante_ia or "Leyendas Rival",
                            "score": p.goles_visitante,
                            "formation": p.formacion_visitante,
                        },
                        "mvp": {
                            "name": p.mvp_nombre,
                            "role": p.mvp_rol,
                            "matchRating": p.mvp_rating,
                            "isRival": p.mvp_equipo == "visitante",
                        } if p.mvp_nombre else None,
                        "stats": {
                            "homePossession": p.posesion_local,
                            "awayPossession": p.posesion_visitante,
                            "homeShots": p.tiros_local,
                            "awayShots": p.tiros_visitante,
                            "homeSaves": p.atajadas_local,
                            "awaySaves": p.atajadas_visitante,
                            "homeYellowCards": p.amarillas_local,
                            "awayYellowCards": p.amarillas_visitante,
                            "homeRedCards": p.rojas_local,
                            "awayRedCards": p.rojas_visitante,
                        },
                        "events": serialized_events,
                        "fecha": p.fecha_partido.strftime("%H:%M") if p.fecha_partido else "Reciente",
                        "relativeDate": p.fecha_partido.strftime("%d/%m/%Y") if p.fecha_partido else "Hoy",
                    }
                )
            return {"history": history_list}
    except Exception as e:
        print(f"[Matches API] DB read error: {e}")

    return {"history": MATCH_HISTORY_CACHE[:limit]}
