"""
Rutas para analíticas del meta-juego: jugadores más comprados, efectividad por formación, etc.
"""

from fastapi import APIRouter

router = APIRouter()

@router.get("/meta-stats")
def get_meta_stats():
    """Retorna estadísticas avanzadas de uso de leyendas y formaciones."""
    return {"most_picked_legends": [], "winrates_by_formation": {}}
