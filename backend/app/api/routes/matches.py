"""
Rutas de simulación de partidos: cálculo de resultado basado en atributos y penalizaciones activas.
Integración con CPU Opponents (20 planteles), base de datos de partidos y cálculo de puntos (+15, +5, 0).
"""

import json
import os
import random
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.services.simulation_service import SimulationService

router = APIRouter()
simulation_service = SimulationService()

# Carga de equipos CPU
CPU_TEAMS_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "seed", "cpu_teams.json")
CPU_TEAMS: List[Dict[str, Any]] = []

if os.path.exists(CPU_TEAMS_PATH):
    try:
        with open(CPU_TEAMS_PATH, "r", encoding="utf-8") as f:
            CPU_TEAMS = json.load(f)
    except Exception as e:
        print(f"[Matches API] Error cargando cpu_teams.json: {e}")

# Historial en memoria (fallback resiliente para desarrollo/offline)
MATCH_HISTORY_CACHE: List[Dict[str, Any]] = []


class SimulateRequest(BaseModel):
    home_squad: Optional[Dict[str, Any]] = None
    away_squad: Optional[Dict[str, Any]] = None
    user_id: Optional[int] = 1


def _get_random_cpu_squad() -> Dict[str, Any]:
    if not CPU_TEAMS:
        return {
            "name": "Equipo Rival",
            "formation": "1-1-3-1",
            "players": [
                {"name": "Buffon", "role": "POR", "rating_general": 88, "rating_defensa": 30, "rating_fisico": 80, "rating_palmares": 85},
                {"name": "Beckenbauer", "role": "DEF", "rating_general": 90, "rating_defensa": 92, "rating_fisico": 85, "rating_palmares": 95},
                {"name": "Maradona", "role": "MC", "rating_general": 95, "rating_creacion": 98, "rating_tecnica": 99, "rating_fisico": 78, "rating_palmares": 98},
                {"name": "Cruyff", "role": "MC", "rating_general": 93, "rating_creacion": 95, "rating_tecnica": 96, "rating_fisico": 82, "rating_palmares": 95},
                {"name": "Pirlo", "role": "MC", "rating_general": 89, "rating_creacion": 94, "rating_tecnica": 93, "rating_fisico": 75, "rating_palmares": 90},
                {"name": "Pelé", "role": "DEL", "rating_general": 97, "rating_ataque": 98, "rating_tecnica": 97, "rating_fisico": 88, "rating_palmares": 99}
            ]
        }
    team = random.choice(CPU_TEAMS)
    return {
        "name": team["nombre_equipo"],
        "formation": team["formacion"],
        "players": [
            {
                "name": j["nombre"],
                "role": j.get("role") or j.get("posicion_base") or "MC",
                "posicion_base": j.get("posicion_base") or j.get("role") or "MC",
                "rating_general": j.get("media_juego") or j.get("rating_general") or 75,
                "rating_ataque": j.get("rating_ataque") or 70,
                "rating_defensa": j.get("rating_defensa") or 70,
                "rating_creacion": j.get("rating_creacion") or 70,
                "rating_tecnica": j.get("rating_tecnica") or 70,
                "rating_fisico": j.get("rating_fisico") or 80,
                "rating_palmares": j.get("rating_palmares") or 70
            }
            for j in team.get("jugadores", [])
        ]
    }


@router.post("/simulate")
def simulate_match(req: Optional[SimulateRequest] = None, db: Optional[Session] = Depends(get_db)):
    """Ejecuta el motor de simulación 6v6 entre dos plantillas de leyendas con los 5 componentes clave."""
    payload = req.model_dump() if req else {}
    home_squad = payload.get("home_squad")
    away_squad = payload.get("away_squad")

    if not home_squad or not home_squad.get("players"):
        home_squad = {
            "name": "Tu Equipo",
            "formation": "1-2-2-1",
            "players": [
                {"name": "Casillas", "role": "POR", "rating_general": 89, "rating_defensa": 30, "rating_creacion": 20, "rating_tecnica": 40, "rating_ataque": 10, "rating_fisico": 82, "rating_palmares": 88},
                {"name": "Maldini", "role": "DEF", "rating_general": 92, "rating_defensa": 92, "rating_creacion": 70, "rating_tecnica": 78, "rating_ataque": 40, "rating_fisico": 85, "rating_palmares": 92},
                {"name": "Baresi", "role": "DEF", "rating_general": 90, "rating_defensa": 93, "rating_creacion": 68, "rating_tecnica": 75, "rating_ataque": 35, "rating_fisico": 79, "rating_palmares": 90},
                {"name": "Zidane", "role": "MC", "rating_general": 96, "rating_creacion": 96, "rating_tecnica": 98, "rating_ataque": 88, "rating_defensa": 65, "rating_fisico": 83, "rating_palmares": 95},
                {"name": "Xavi", "role": "MC", "rating_general": 94, "rating_creacion": 97, "rating_tecnica": 95, "rating_ataque": 78, "rating_defensa": 68, "rating_fisico": 76, "rating_palmares": 94},
                {"name": "Messi", "role": "DEL", "rating_general": 99, "rating_ataque": 99, "rating_tecnica": 99, "rating_creacion": 95, "rating_defensa": 35, "rating_fisico": 80, "rating_palmares": 99}
            ]
        }

    if not away_squad or not away_squad.get("players"):
        away_squad = _get_random_cpu_squad()

    sim_result = simulation_service.simulate(home_squad, away_squad)

    # Cálculo de resultado y puntos
    home_score = sim_result["home_team"]["score"]
    away_score = sim_result["away_team"]["score"]

    if home_score > away_score:
        res_type = "VICTORIA"
        pts = 15
        elo_var = 25
    elif home_score == away_score:
        res_type = "EMPATE"
        pts = 5
        elo_var = 5
    else:
        res_type = "DERROTA"
        pts = 0
        elo_var = -15

    # MVP
    goal_events = [e for e in sim_result.get("events", []) if e.get("type") == "goal"]
    mvp = goal_events[0]["player"] if goal_events else home_squad["players"][0]["name"]

    summary = {
        "result_type": res_type,
        "points_gained": pts,
        "elo_variation": elo_var,
        "mvp": mvp
    }
    sim_result["summary"] = summary

    # Intento de persistencia en base de datos si la conexión está disponible
    try:
        if db:
            db.execute(
                text("""
                    INSERT INTO partidos (user_id, plantilla_id, rival_nombre, goles_local, goles_visitante, resultado, variacion_elo)
                    VALUES (:uid, 1, :rival, :g_home, :g_away, :res, :elo)
                """),
                {
                    "uid": payload.get("user_id", 1),
                    "rival": away_squad.get("name", "Equipo Rival"),
                    "g_home": home_score,
                    "g_away": away_score,
                    "res": res_type.lower(),
                    "elo": elo_var
                }
            )
            db.commit()
    except Exception as db_err:
        print(f"[Matches API] DB persist error (fallback activo): {db_err}")

    MATCH_HISTORY_CACHE.insert(0, {
        "match_id": sim_result["match_id"],
        "home_team": sim_result["home_team"]["name"],
        "away_team": sim_result["away_team"]["name"],
        "home_score": home_score,
        "away_score": away_score,
        "result": res_type,
        "points": pts,
        "date": "Reciente"
    })
    if len(MATCH_HISTORY_CACHE) > 50:
        MATCH_HISTORY_CACHE.pop()

    return sim_result


@router.get("/cpu-opponents")
def get_cpu_opponents():
    """Retorna los 20 planteles de la CPU disponibles para competir."""
    return {"count": len(CPU_TEAMS), "teams": CPU_TEAMS}


@router.get("/history")
def get_match_history(limit: int = Query(10, ge=1, le=50), db: Optional[Session] = Depends(get_db)):
    """Retorna el historial de partidos disputados con sus marcadores y puntos obtenidos."""
    try:
        if db:
            res = db.execute(
                text("SELECT id, rival_nombre, goles_local, goles_visitante, resultado, variacion_elo, fecha_partido FROM partidos ORDER BY id DESC LIMIT :lim"),
                {"lim": limit}
            )
            rows = res.fetchall()
            if rows:
                return {
                    "history": [
                        {
                            "id": r[0],
                            "rival": r[1],
                            "score": f"{r[2]} - {r[3]}",
                            "resultado": r[4].upper(),
                            "elo": r[5],
                            "fecha": str(r[6])
                        }
                        for r in rows
                    ]
                }
    except Exception as e:
        print(f"[Matches API] DB read error: {e}")

    return {"history": MATCH_HISTORY_CACHE[:limit]}
