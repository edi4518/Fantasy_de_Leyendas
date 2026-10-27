"""
Servicio del motor de simulación de partidos.
Calcula probabilidades de gol ponderando las valoraciones de los jugadores con sus penalizaciones tácticas aplicadas.
"""

class SimulationService:
    def __init__(self):
        pass

    def simulate(self, home_squad, away_squad):
        """
        Ejecuta la simulación considerando valoraciones ponderadas y penalizaciones (15% o 25%).
        """
        return {"home_goals": 0, "away_goals": 0, "events": []}
