"""
Punto de entrada principal para el backend FastAPI de Fantasy de Leyendas PWA.
Expone la API del catálogo de jugadores, motor de simulación de partidos,
autenticación de mánagers y verificación de estado del servicio.
"""

import os
import unicodedata
from typing import List

from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

# Configuración central y base de datos
from app.core.config import settings
from app.core.database import get_db
from app.models.player import Player

# Routers de la aplicación
from app.api.routes import players, matches
from app.api.routes.auth import router as auth_router

# Inicialización de la aplicación FastAPI
app = FastAPI(
    title="Fantasy de Leyendas API",
    description="API RESTful de Fantasy de Leyendas - Catálogo de 80 leyendas del fútbol histórico y motor de simulación 6v6",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# 1. Configuración de CORS
origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

# Integrar orígenes definidos en settings si existen
if hasattr(settings, "CORS_ORIGINS") and settings.CORS_ORIGINS:
    for origin in settings.CORS_ORIGINS:
        if origin not in origins:
            origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Servir estáticos locales para avatares y archivos subidos
UPLOAD_DIR = os.path.join("uploads", "avatars")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# 3. Registrar routers modulares
app.include_router(auth_router)
app.include_router(matches.router, prefix="/api/matches", tags=["Matches"])
app.include_router(players.router, prefix="/api/players", tags=["Players"])

# 4. Configuración de imágenes en Supabase para jugadores
SUPABASE_STORAGE_URL = os.getenv(
    "SUPABASE_STORAGE_URL",
    "https://jkdrdrdggclbjatzbpev.supabase.co/storage/v1/object/public/players/"
)


def slugify(text: str) -> str:
    """Limpia tildes y espacios para armar el nombre del archivo webp."""
    if not text:
        return ""
    normalizado = unicodedata.normalize("NFKD", text)
    limpio = "".join([c for c in normalizado if not unicodedata.combining(c)])
    return limpio.lower().strip().replace(" ", "_").replace("'", "")


@app.get("/api/players/catalog", tags=["Players Catalog"])
@app.get("/api/players", tags=["Players Catalog"])
def get_players(
    search: str = Query(None, description="Buscar por nombre"),
    db: Session = Depends(get_db)
):
    """Endpoint directo del catálogo de leyendas con URLs de retratos optimizadas en Supabase."""
    query = db.query(Player)

    if search:
        query = query.filter(Player.nombre.ilike(f"%{search}%"))

    players_list = query.all()

    resultado = []
    for p in players_list:
        slug = slugify(p.nombre)

        resultado.append({
            "id": p.id,
            "name": p.nombre,
            "position": p.posicion_base,
            "position_detail": p.posicion_detalle,
            "nationality": p.nacionalidad,
            "price": getattr(p, "precio_mercado_mv", getattr(p, "precio", 10)),
            "rating_attack": p.rating_ataque,
            "rating_creation": p.rating_creacion,
            "rating_technique": p.rating_tecnica,
            "rating_general": getattr(p, "rating_general", getattr(p, "media_juego", 85)),
            "photo_url": f"{SUPABASE_STORAGE_URL}{slug}.webp"
        })

    return resultado


@app.get("/api/health", tags=["Health"])
@app.get("/health", tags=["Health"], include_in_schema=False)
def health_check():
    """Endpoint de verificación de estado y salud del servicio."""
    return {"status": "ok"}
