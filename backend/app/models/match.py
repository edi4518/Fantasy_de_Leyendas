from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func
from app.core.database import Base


class Partido(Base):
    """Modelo ORM que mapea la tabla 'partidos' (Encuentros PvP o vs IA con MVP y estadísticas detalladas)."""

    __tablename__ = "partidos"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    local_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    visitante_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    nombre_visitante_ia = Column(String(100), nullable=True, default="Leyendas Rival")

    plantilla_local_id = Column(Integer, ForeignKey("plantillas.id", ondelete="RESTRICT"), nullable=False)
    plantilla_visitante_id = Column(Integer, ForeignKey("plantillas.id", ondelete="SET NULL"), nullable=True)
    formacion_local = Column(String(10), nullable=False, default="1-2-2-1")
    formacion_visitante = Column(String(10), nullable=False, default="1-2-2-1")

    goles_local = Column(Integer, nullable=False, default=0)
    goles_visitante = Column(Integer, nullable=False, default=0)
    resultado = Column(String(20), nullable=False, default="empate")  # 'local', 'empate', 'visitante'

    variacion_elo_local = Column(Integer, nullable=False, default=0)
    variacion_elo_visitante = Column(Integer, nullable=False, default=0)

    # MVP del partido
    mvp_nombre = Column(String(120), nullable=True)
    mvp_rol = Column(String(10), nullable=True)
    mvp_rating = Column(Float, nullable=True)
    mvp_equipo = Column(String(15), nullable=True, default="local")

    # Estadísticas cara a cara del partido
    posesion_local = Column(Integer, nullable=False, default=50)
    posesion_visitante = Column(Integer, nullable=False, default=50)
    tiros_local = Column(Integer, nullable=False, default=0)
    tiros_visitante = Column(Integer, nullable=False, default=0)
    atajadas_local = Column(Integer, nullable=False, default=0)
    atajadas_visitante = Column(Integer, nullable=False, default=0)
    amarillas_local = Column(Integer, nullable=False, default=0)
    amarillas_visitante = Column(Integer, nullable=False, default=0)
    rojas_local = Column(Integer, nullable=False, default=0)
    rojas_visitante = Column(Integer, nullable=False, default=0)

    seed_simulacion = Column(Integer, nullable=True)
    fecha_partido = Column(DateTime, server_default=func.now())


class EventoPartido(Base):
    """Modelo ORM que mapea la tabla 'eventos_partido' (Timeline minuto a minuto del partido)."""

    __tablename__ = "eventos_partido"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    partido_id = Column(Integer, ForeignKey("partidos.id", ondelete="CASCADE"), nullable=False, index=True)
    minuto = Column(Integer, nullable=False, default=0)
    segundo = Column(Integer, nullable=False, default=0)
    tipo = Column(String(50), nullable=False)
    descripcion = Column(String(255), nullable=False)

    equipo = Column(String(15), nullable=False, default="local")  # 'local' | 'visitante'
    player_id = Column(Integer, ForeignKey("players.id", ondelete="SET NULL"), nullable=True)
    jugador_nombre = Column(String(120), nullable=True)

