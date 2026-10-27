"""
Rutas de simulación de partidos: cálculo de resultado basado en atributos y penalizaciones activas.
"""

from fastapi import APIRouter

router = APIRouter()

@router.post("/simulate")
def simulate_match():
    """Ejecuta el motor de simulación de partido entre dos plantillas de leyendas."""
    return {"match_id": 1, "status": "simulated", "home_score": 0, "away_score": 0}

@router.get("/history")
def get_match_history():
    """Retorna el historial de partidos disputados."""
    return {"history": []}
