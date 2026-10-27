from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.player import Player
from app.schemas.player_schema import PlayerResponse

router = APIRouter()

VALID_POSITIONS = {"POR", "DEF", "MC", "DEL"}


@router.get("", response_model=List[PlayerResponse])
@router.get("/", response_model=List[PlayerResponse], include_in_schema=False)
def list_players(
    posicion_base: Optional[str] = Query(
        None,
        description="Filtrado por posición base: 'POR', 'DEF', 'MC', 'DEL'"
    ),
    search: Optional[str] = Query(
        None,
        description="Búsqueda insensible a mayúsculas/minúsculas en el campo nombre"
    ),
    max_precio: Optional[float] = Query(
        None,
        ge=0,
        description="Límite máximo de precio para el presupuesto del mercado"
    ),
    db: Session = Depends(get_db)
):
    """Lista las leyendas del catálogo con soporte para filtros opcionales por posición, nombre y precio."""
    query = db.query(Player)

    if posicion_base:
        pos_upper = posicion_base.strip().upper()
        if pos_upper not in VALID_POSITIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Posición '{posicion_base}' no válida. Valores permitidos: {', '.join(sorted(VALID_POSITIONS))}"
            )
        query = query.filter(Player.posicion_base == pos_upper)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(Player.nombre.ilike(search_term))

    if max_precio is not None:
        query = query.filter(Player.precio <= max_precio)

    # Ordenar por media de juego descendente y luego por precio
    return query.order_by(Player.media_juego.desc(), Player.precio.desc()).all()


@router.get("/{player_id}", response_model=PlayerResponse)
def get_player(
    player_id: int,
    db: Session = Depends(get_db)
):
    """Retorna los datos completos de una leyenda específica por su ID. Lanza 404 si no existe."""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Leyenda con ID {player_id} no encontrada."
        )
    return player
