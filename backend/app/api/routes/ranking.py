"""
Rutas para el ranking general de directores técnicos y puntos de temporada (ELO y diferencia de gol en MySQL).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User

router = APIRouter()


@router.get("/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    """Retorna la tabla general de posiciones de los mánagers registrados ordenados por ELO y diferencia de gol."""
    users = db.query(User).all()
    # Ordenar en Python para evitar errores de MySQL/TiDB (1690 BIGINT UNSIGNED out of range en resta)
    users.sort(
        key=lambda u: (
            1 if (u.partidos_jugados or 0) > 0 else 0,
            u.elo_rating if u.elo_rating is not None else 1000,
            (u.goles_favor or 0) - (u.goles_contra or 0),
            u.victorias or 0,
            -(u.id or 0),
        ),
        reverse=True,
    )
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
    return {"count": len(leaderboard), "leaderboard": leaderboard}
