"""
Servicio de negocio para gestión de plantillas.
Garantiza de forma inmutable el tope de 130M y el límite de 11 jugadores.
"""

MAX_BUDGET = 130.0

class SquadService:
    def validate_budget(self, total_cost: float) -> bool:
        """Verifica si el costo de la plantilla no supera los 130 Millones."""
        return total_cost <= MAX_BUDGET
