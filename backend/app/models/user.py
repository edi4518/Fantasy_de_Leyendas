from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Boolean, Text, func
from app.core.database import Base


class User(Base):
    """Modelo ORM que mapea la tabla 'users' (Mánagers registrados con sus métricas competitivas)."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(100), nullable=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    nombre = Column(String(80), nullable=False)
    apellido = Column(String(80), nullable=False)
    team_name = Column(String(100), nullable=False)
    rol = Column(String(50), nullable=False, default="manager")
    fecha_nacimiento = Column(Date, nullable=True)
    photo_url = Column(Text, nullable=True)

    # Economía y Competitivo
    presupuesto = Column(Float, nullable=False, default=150.00)
    elo_rating = Column(Integer, nullable=False, default=1000, index=True)
    partidos_jugados = Column(Integer, nullable=False, default=0)
    victorias = Column(Integer, nullable=False, default=0)
    empates = Column(Integer, nullable=False, default=0)
    derrotas = Column(Integer, nullable=False, default=0)
    goles_favor = Column(Integer, nullable=False, default=0)
    goles_contra = Column(Integer, nullable=False, default=0)

    # Preferencias del Mánager
    notif_activas = Column(Boolean, nullable=False, default=True)
    sonido_activo = Column(Boolean, nullable=False, default=False)

    auth_provider = Column(String(20), nullable=False, default="local")
    created_at = Column(DateTime, server_default=func.now())
