from sqlalchemy import Column, Integer, String, Float, Enum
from app.core.database import Base


class Player(Base):
    """Modelo ORM que mapea la tabla 'players' con las 80 leyendas y sus atributos estadísticos."""

    __tablename__ = "players"

    # Identificador y datos biográficos
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(120), nullable=False)
    posicion_base = Column(Enum("POR", "DEF", "MC", "DEL", name="posicion_base_enum"), nullable=False, index=True)
    posicion_detalle = Column(String(60), nullable=False)
    nacionalidad = Column(String(80), nullable=False)

    # Métricas de volumen histórico
    partidos_oficiales = Column(Integer, default=0)
    minutos_jugados = Column(Integer, default=0)
    vallas_invictas = Column(Integer, default=0)
    goles_oficiales = Column(Integer, default=0)
    remates_totales = Column(Integer, default=0)
    asistencias_oficiales = Column(Integer, default=0)
    pases_intentados = Column(Integer, default=0) 
    pases_completados = Column(Integer, default=0)
    pases_clave = Column(Integer, default=0)
    regates_intentados = Column(Integer, default=0)
    regates_exitosos = Column(Integer, default=0)
    recuperaciones = Column(Integer, default=0)
    intercepciones = Column(Integer, default=0)
    entradas_exitosas = Column(Integer, default=0)
    duelos_defensivos_totales = Column(Integer, default=0)
    duelos_defensivos_ganados = Column(Integer, default=0)
    ocasiones_creadas = Column(Integer, default=0)
    goles_sin_penal = Column(Integer, default=0)
    distinciones_individuales = Column(Integer, default=0)
    balones_de_oro = Column(Integer, default=0)
    titulos_totales = Column(Integer, default=0)

    # Métricas P90 y porcentajes calculados
    goles_sin_penal_p90 = Column(Float, default=0.0)
    goles_p90 = Column(Float, default=0.0)
    conversion_goles = Column(Float, default=0.0)
    rating_ataque = Column(Integer, nullable=False, default=0)

    asistencias_p90 = Column(Float, default=0.0)
    pases_clave_p90 = Column(Float, default=0.0)
    ocasiones_creadas_p90 = Column(Float, default=0.0)
    rating_creacion = Column(Integer, nullable=False, default=0)

    porcentaje_regates = Column(Float, default=0.0)
    precision_pases = Column(Float, default=0.0)
    rating_tecnica = Column(Integer, nullable=False, default=0)

    porcentaje_duelos_defensivos = Column(Float, default=0.0)
    entradas_exitosas_p90 = Column(Float, default=0.0)
    intercepciones_p90 = Column(Float, default=0.0)
    recuperaciones_p90 = Column(Float, default=0.0)
    rating_defensa = Column(Integer, nullable=False, default=0)

    duelos_ganados_p90 = Column(Float, default=0.0)
    rating_fisico = Column(Integer, nullable=False, default=0)

    distinciones_norm = Column(Float, default=0.0)
    balones_oro_norm = Column(Float, default=0.0)
    titulos_norm = Column(Float, default=0.0)
    rating_palmares = Column(Integer, nullable=False, default=0)

    # Economía y Ratings del juego
    precio = Column(Float, nullable=False, default=0.0, index=True)
    rating_general = Column(Integer, nullable=False, default=0)
    media_juego = Column(Integer, nullable=False, default=0, index=True)
