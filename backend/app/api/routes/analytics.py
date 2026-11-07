"""
Rutas para analíticas del meta-juego y resumen de racha del mánager desde MySQL:
consulta las tablas 'partidos', 'user_players', 'players' y 'users'.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.match import Partido
from app.models.player import Player
from app.models.squad import UserPlayer
from app.models.user import User

import logging

logger = logging.getLogger("fantasy_analytics")

router = APIRouter()


def _resolve_user(request: Request, db: Session, explicit_user_id: Optional[int] = None) -> Optional[User]:
    auth_header = request.headers.get("Authorization", "")
    if "token_user_" in auth_header:
        try:
            uid = int(auth_header.split("token_user_")[-1].strip())
            user = db.query(User).filter(User.id == uid).first()
            if user:
                return user
        except ValueError:
            pass
    if explicit_user_id:
        user = db.query(User).filter(User.id == explicit_user_id).first()
        if user:
            return user
    return db.query(User).order_by(User.id.desc()).first()


@router.get("/meta-stats")
def get_meta_stats(db: Session = Depends(get_db)):
    """Retorna estadísticas reales de uso de leyendas y efectividad de formaciones en MySQL."""
    try:
        top_picked = (
            db.query(Player.nombre, Player.posicion_base, func.count(UserPlayer.id).label("picks"))
            .join(UserPlayer, UserPlayer.player_id == Player.id)
            .group_by(Player.id, Player.nombre, Player.posicion_base)
            .order_by(func.count(UserPlayer.id).desc())
            .limit(5)
            .all()
        )
        most_picked_legends = [
            {"name": row[0], "role": row[1], "picks": row[2]} for row in top_picked
        ]

        partidos = db.query(Partido).all()
        formation_totals = {}
        formation_wins = {}
        for p in partidos:
            form = p.formacion_local or "1-2-2-1"
            formation_totals[form] = formation_totals.get(form, 0) + 1
            if p.resultado == "local":
                formation_wins[form] = formation_wins.get(form, 0) + 1

        winrates = {
            f: round((formation_wins.get(f, 0) / total) * 100, 1)
            for f, total in formation_totals.items()
            if total > 0
        }
        return {
            "most_picked_legends": most_picked_legends,
            "winrates_by_formation": winrates,
        }
    except Exception:
        return {"most_picked_legends": [], "winrates_by_formation": {}}


@router.get("/summary")
def get_summary(
    request: Request,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Retorna resumen analítico de rendimiento, MVP del club y racha real de partidos desde MySQL."""
    try:
        user = _resolve_user(request, db, user_id)

        recent_results = []
        last_match_data = None
        mvp_data = None

        if user:
            partidos = (
                db.query(Partido)
                .filter(Partido.local_user_id == user.id)
                .order_by(Partido.id.desc())
                .limit(5)
                .all()
            )

            for p in partidos:
                if p.resultado == "local":
                    letter = "V"
                elif p.resultado == "empate":
                    letter = "E"
                else:
                    letter = "D"
                recent_results.append(letter)

            if partidos:
                latest = partidos[0]
                latest_letter = recent_results[0]
                rival_name = latest.nombre_visitante_ia or "Leyendas Rival"
                last_match_data = {
                    "id": latest.id,
                    "result": latest_letter,
                    "score": f"{latest.goles_local} – {latest.goles_visitante}",
                    "opponent": rival_name if rival_name.startswith("vs ") else f"vs {rival_name}",
                }

            # Buscar el jugador con mejor rendimiento en el club del usuario (user_players)
            user_players = (
                db.query(UserPlayer, Player)
                .join(Player, Player.id == UserPlayer.player_id)
                .filter(UserPlayer.user_id == user.id)
                .all()
            )
            if user_players:
                best_up, best_p = max(
                    user_players,
                    key=lambda item: (
                        (item[0].mvps_club or 0) * 15
                        + (item[0].goles_club or 0) * 5
                        + float(item[0].rating_promedio or 0) * 2
                        + (item[0].partidos_club or 0),
                        item[1].media_juego or 0,
                    ),
                )
                mvp_data = {
                    "id": best_p.id,
                    "name": best_p.nombre,
                    "position": best_p.posicion_base,
                    "matches": best_up.partidos_club or 0,
                    "goals": best_up.goles_club or 0,
                    "mvpAwards": best_up.mvps_club or 0,
                    "score": float(best_up.rating_promedio) if (best_up.partidos_club or 0) > 0 and best_up.rating_promedio else "-",
                    "image_filename": best_p.image_filename,
                }

        return {
            "has_matches": len(recent_results) > 0,
            "streak": {
                "recentResults": recent_results,
                "lastMatch": last_match_data,
            },
            "mvp": mvp_data,
            "most_picked_legends": [],
            "winrates_by_formation": {},
        }
    except Exception as e:
        logger.error(f"Aviso en /analytics/summary: {e}", exc_info=True)
        return {
            "has_matches": False,
            "streak": {
                "recentResults": [],
                "lastMatch": None,
            },
            "mvp": None,
            "most_picked_legends": [],
            "winrates_by_formation": {},
        }

