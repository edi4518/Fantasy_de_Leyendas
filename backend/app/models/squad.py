from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, UniqueConstraint, func
from app.core.database import Base


class UserPlayer(Base):
    """Modelo ORM que mapea la tabla 'user_players' (Inventario/Club de leyendas compradas por cada usuario, con su energía y estadísticas en el club)."""

    __tablename__ = "user_players"
    __table_args__ = (
        UniqueConstraint("user_id", "player_id", name="uk_user_player"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    player_id = Column(Integer, ForeignKey("players.id", ondelete="RESTRICT"), nullable=False)
    precio_compra = Column(Float, nullable=False, default=0.00)

    # Estado físico (Stamina) y estadísticas acumuladas en el club del usuario
    energia = Column(Integer, nullable=False, default=100)
    partidos_club = Column(Integer, nullable=False, default=0)
    goles_club = Column(Integer, nullable=False, default=0)
    vallas_invictas_club = Column(Integer, nullable=False, default=0)
    mvps_club = Column(Integer, nullable=False, default=0)
    rating_promedio = Column(Float, nullable=False, default=0.00)

    adquirido_en = Column(DateTime, server_default=func.now())


class Plantilla(Base):
    """Modelo ORM que mapea la tabla 'plantillas' (Alineación táctica activa del mánager)."""

    __tablename__ = "plantillas"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    nombre = Column(String(50), nullable=False, default="Mi Alineación Principal")
    formacion = Column(String(10), nullable=False, default="1-2-2-1")
    costo_total = Column(Float, nullable=False, default=0.00)
    es_activa = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class PlantillaJugador(Base):
    """Modelo ORM que mapea la tabla 'plantilla_jugadores' (Titulares y suplentes vinculados a user_players)."""

    __tablename__ = "plantilla_jugadores"
    __table_args__ = (
        UniqueConstraint("plantilla_id", "posicion_cancha", name="uk_plantilla_posicion"),
        UniqueConstraint("plantilla_id", "user_player_id", name="uk_plantilla_user_player"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    plantilla_id = Column(Integer, ForeignKey("plantillas.id", ondelete="CASCADE"), nullable=False, index=True)
    user_player_id = Column(Integer, ForeignKey("user_players.id", ondelete="CASCADE"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id", ondelete="RESTRICT"), nullable=False)
    es_titular = Column(Boolean, nullable=False, default=True)
    posicion_cancha = Column(String(10), nullable=False)
    orden = Column(Integer, nullable=False, default=1)
