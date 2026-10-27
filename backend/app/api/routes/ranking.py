"""
Rutas para el ranking general de directores técnicos y puntos de temporada.
"""

from fastapi import APIRouter

router = APIRouter()

@router.get("/leaderboard")
def get_leaderboard():
    """Retorna la tabla general de posiciones de la liga."""
    return {"leaderboard": []}
