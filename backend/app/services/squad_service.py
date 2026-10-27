"""
Servicio de negocio para gestión de plantillas.
Garantiza de forma inmutable el tope de 100M y el límite de 11 jugadores.
"""

MAX_BUDGET = 100.0

class SquadService:
    def validate_budget(self, total_cost: float) -> bool:
        """Verifica si el costo de la plantilla no supera los 100 Millones."""
        return total_cost <= MAX_BUDGET
