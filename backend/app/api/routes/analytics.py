"""
Rutas para analíticas del meta-juego: jugadores más comprados, efectividad por formación, etc.
"""

from fastapi import APIRouter

router = APIRouter()

@router.get("/meta-stats")
def get_meta_stats():
    """Retorna estadísticas avanzadas de uso de leyendas y formaciones."""
    return {"most_picked_legends": [], "winrates_by_formation": {}}

@router.get("/summary")
def get_summary():
    """Retorna resumen analítico de rendimiento y racha de partidos del mánager."""
    return {
        "streak": {
            "recentResults": ["V", "V", "E", "V", "D"],
            "lastMatch": {
                "result": "V",
                "score": "2 – 1",
                "opponent": "vs Dioses del Estadio"
            }
        },
        "most_picked_legends": [],
        "winrates_by_formation": {}
    }
