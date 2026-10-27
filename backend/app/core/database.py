from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

# Creación del motor SQLAlchemy para MySQL con verificación de conexión activa (pool_pre_ping)
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
)

# Fábrica de sesiones de base de datos
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Clase base declarativa para los modelos ORM
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Generador de sesiones de base de datos para inyección de dependencias en FastAPI.
    
    Asegura que la sesión se cierre adecuadamente al finalizar el ciclo de vida del request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
