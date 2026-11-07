"""
Rutas para el ranking general de directores técnicos y puntos de temporada (ELO y diferencia de gol en MySQL).
"""

import time
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User

router = APIRouter()

# Caché en memoria de 30s para evitar consultas pesadas repetidas a TiDB Cloud
_LEADERBOARD_CACHE = {"data": None, "timestamp": 0.0}
_LEADERBOARD_TTL = 30.0


def _user_rank_sort_key(user: User):
    return (
        1 if (user.partidos_jugados or 0) > 0 else 0,
        user.elo_rating if user.elo_rating is not None else 1000,
        (user.goles_favor or 0) - (user.goles_contra or 0),
        user.victorias or 0,
        -(user.id or 0),
    )


def invalidate_leaderboard_cache():
    _LEADERBOARD_CACHE["data"] = None
    _LEADERBOARD_CACHE["timestamp"] = 0.0


def get_user_rank(db: Session, user_id: int):
    users = db.query(User).all()
    ranked_users = [user for user in users if (user.partidos_jugados or 0) > 0]
    ranked_users.sort(key=_user_rank_sort_key, reverse=True)

    return next(
        (position for position, user in enumerate(ranked_users, start=1) if user.id == user_id),
        None,
    )


@router.get("/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    """Retorna la tabla general de posiciones de los mánagers registrados ordenados por ELO y diferencia de gol."""
    now = time.time()
    if _LEADERBOARD_CACHE["data"] and (now - _LEADERBOARD_CACHE["timestamp"] < _LEADERBOARD_TTL):
        return _LEADERBOARD_CACHE["data"]

    users = db.query(User).all()
    # Ordenar en Python para evitar errores de MySQL/TiDB (1690 BIGINT UNSIGNED out of range en resta)
    users.sort(key=_user_rank_sort_key, reverse=True)
    leaderboard = [
        {
            "position": idx + 1,
            "user_id": u.id,
            "email": u.email,
            "manager_name": f"{u.nombre} {u.apellido}".strip(),
            "team_name": u.team_name,
            "elo_rating": u.elo_rating if u.elo_rating is not None else 1000,
            "partidos_jugados": u.partidos_jugados or 0,
            "has_played": bool((u.partidos_jugados or 0) > 0),
            "victorias": u.victorias or 0,
            "empates": u.empates or 0,
            "derrotas": u.derrotas or 0,
            "goles_favor": u.goles_favor or 0,
            "goles_contra": u.goles_contra or 0,
            "diferencia_gol": (u.goles_favor or 0) - (u.goles_contra or 0),
            "presupuesto": float(u.presupuesto if u.presupuesto is not None else 100.0),
            "photo_url": u.photo_url,
        }
        for idx, u in enumerate(users)
    ]
    result = {"count": len(leaderboard), "leaderboard": leaderboard}
    _LEADERBOARD_CACHE["data"] = result
    _LEADERBOARD_CACHE["timestamp"] = now
    return result
