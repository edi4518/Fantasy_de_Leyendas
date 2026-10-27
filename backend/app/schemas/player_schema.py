from pydantic import BaseModel, ConfigDict


class PlayerResponse(BaseModel):
    """Esquema de serialización Pydantic para los datos completos de una leyenda."""

    id: int
    nombre: str
    posicion_base: str
    posicion_detalle: str
    nacionalidad: str

    # Métricas de volumen histórico
    partidos_oficiales: int = 0
    minutos_jugados: int = 0
    vallas_invictas: int = 0
    goles_oficiales: int = 0
    remates_totales: int = 0
    asistencias_oficiales: int = 0
    pases_intentados: int = 0
    pases_completados: int = 0
    pases_clave: int = 0
    regates_intentados: int = 0
    regates_exitosos: int = 0
    recuperaciones: int = 0
    intercepciones: int = 0
    entradas_exitosas: int = 0
    duelos_defensivos_totales: int = 0
    duelos_defensivos_ganados: int = 0
    ocasiones_creadas: int = 0
    goles_sin_penal: int = 0
    distinciones_individuales: int = 0
    balones_de_oro: int = 0
    titulos_totales: int = 0

    # Métricas P90 y porcentajes calculados
    goles_sin_penal_p90: float = 0.0
    goles_p90: float = 0.0
    conversion_goles: float = 0.0
    rating_ataque: int = 0

    asistencias_p90: float = 0.0
    pases_clave_p90: float = 0.0
    ocasiones_creadas_p90: float = 0.0
    rating_creacion: int = 0

    porcentaje_regates: float = 0.0
    precision_pases: float = 0.0
    rating_tecnica: int = 0

    porcentaje_duelos_defensivos: float = 0.0
    entradas_exitosas_p90: float = 0.0
    intercepciones_p90: float = 0.0
    recuperaciones_p90: float = 0.0
    rating_defensa: int = 0

    duelos_ganados_p90: float = 0.0
    rating_fisico: int = 0

    distinciones_norm: float = 0.0
    balones_oro_norm: float = 0.0
    titulos_norm: float = 0.0
    rating_palmares: int = 0

    # Economía y Ratings del juego
    precio: float = 0.0
    rating_general: int = 0
    media_juego: int = 0

    model_config = ConfigDict(from_attributes=True)
