"""
Rutas administrativas para el mantenimiento del catálogo de leyendas (ABM).
"""

from fastapi import APIRouter

router = APIRouter()

@router.get("/stats")
def get_admin_stats():
    """Estadísticas globales de uso del sistema para administradores."""
    return {"total_users": 0, "total_matches": 0}
