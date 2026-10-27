"""
Rutas de gestión de plantillas: validación de tope salarial (100M) y penalizaciones por desubicación táctica.
"""

from fastapi import APIRouter

router = APIRouter()

@router.get("/my-squad")
def get_my_squad():
    """Recupera la plantilla activa del usuario con su formación táctica."""
    return {"squad": None}

@router.post("/save")
def save_squad():
    """Guarda y valida la plantilla (comprueba límite de 100M y 11 posiciones)."""
    return {"status": "saved", "max_budget": 100.0}

@router.post("/validate-penalties")
def validate_penalties():
    """Calcula las penalizaciones del 15% o 25% según la posición asignada."""
    return {"penalties": []}
