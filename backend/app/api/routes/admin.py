"""
Rutas administrativas para el mantenimiento del catálogo de leyendas (ABM).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.player import Player
from app.schemas.player_schema import PlayerResponse

router = APIRouter()

@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    """Estadísticas globales de uso del sistema para administradores."""
    total_players = db.query(Player).count()
    return {"total_users": 1, "total_matches": 0, "total_players": total_players}

@router.post("", response_model=PlayerResponse, status_code=status.HTTP_201_CREATED)
def create_player(player_data: dict, db: Session = Depends(get_db)):
    """Da de alta una nueva leyenda en la base de datos."""
    # Mapeo flexible adaptado a los campos del modelo
    new_player = Player(
        nombre=player_data.get("nombre"),
        posicion_base=player_data.get("posicion", "DEL"),
        posicion_detalle=player_data.get("posicion_detalle", "Delantero"),
        nacionalidad=player_data.get("nacionalidad", "Desconocida"),
        rating_ataque=player_data.get("rating_ataque", 50),
        rating_creacion=player_data.get("rating_creacion", 50),
        rating_defensa=player_data.get("rating_defensa", 50),
        rating_fisico=player_data.get("rating_fisico", 50),
        precio=player_data.get("precio_mercado_mv", 20.0),
        media_juego=int((player_data.get("rating_ataque", 50) + player_data.get("rating_creacion", 50) + player_data.get("rating_defensa", 50) + player_data.get("rating_fisico", 50)) / 4)
    )
    db.add(new_player)
    db.commit()
    db.refresh(new_player)
    return new_player

@router.put("/{player_id}", response_model=PlayerResponse)
def update_player(player_id: int, player_data: dict, db: Session = Depends(get_db)):
    """Modifica los datos y ratings de una leyenda existente."""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Leyenda no encontrada")
    
    player.nombre = player_data.get("nombre", player.nombre)
    player.posicion_base = player_data.get("posicion", player.posicion_base)
    player.nacionalidad = player_data.get("nacionalidad", player.nacionalidad)
    player.rating_ataque = player_data.get("rating_ataque", player.rating_ataque)
    player.rating_creacion = player_data.get("rating_creacion", player.rating_creacion)
    player.rating_defensa = player_data.get("rating_defensa", player.rating_defensa)
    player.rating_fisico = player_data.get("rating_fisico", player.rating_fisico)
    player.precio = player_data.get("precio_mercado_mv", player.precio)
    
    db.commit()
    db.refresh(player)
    return player

@router.delete("/{player_id}")
def delete_player(player_id: int, db: Session = Depends(get_db)):
    """Da de baja una leyenda del sistema."""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Leyenda no encontrada")
    db.delete(player)
    db.commit()
    return {"message": "Leyenda eliminada correctamente"}