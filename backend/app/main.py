"""
Punto de entrada principal para el backend FastAPI de Fantasy de Leyendas PWA.
Expone la API del catálogo de jugadores y verificación de estado con CORS configurado.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import players

# Inicialización de la aplicación FastAPI
app = FastAPI(
    title="Fantasy de Leyendas API",
    description="API RESTful de Fantasy de Leyendas - Catálogo de 80 leyendas del fútbol histórico",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configuración de CORSMiddleware para habilitar solicitudes desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusión de rutas de la API
app.include_router(players.router, prefix="/api/players", tags=["Players"])


@app.get("/api/health", tags=["Health"])
@app.get("/health", tags=["Health"], include_in_schema=False)
def health_check():
    """Endpoint de verificación de estado y salud del servicio."""
    return {"status": "ok"}
