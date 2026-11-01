import os
import unicodedata
from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

# Routers
from app.api.routes.auth import router as auth_router

# Modelos y base de datos
from app.models.player import Player
from app.core.database import get_db

app = FastAPI(title="Fantasy de Leyendas API")

# 1. Configuración de CORS
origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Servir estáticos locales para avatares de mánagers
UPLOAD_DIR = os.path.join("uploads", "avatars")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# 3. Registrar rutas de autenticación
app.include_router(auth_router)

# 4. Configuración de imágenes en Supabase para jugadores
SUPABASE_STORAGE_URL = os.getenv(
    "SUPABASE_STORAGE_URL",
    "https://jkdrdrdggclbjatzbpev.supabase.co/storage/v1/object/public/players/"
)


def slugify(text: str) -> str:
    """Limpia tildes y espacios para armar el nombre del archivo webp."""
    if not text:
        return ""
    normalizado = unicodedata.normalize('NFKD', text)
    limpio = "".join([c for c in normalizado if not unicodedata.combining(c)])
    return limpio.lower().strip().replace(" ", "_").replace("'", "")


@app.get("/api/players")
def get_players(
    search: str = Query(None, description="Buscar por nombre"),
    db: Session = Depends(get_db)
):
    query = db.query(Player)
    
    # Búsqueda filtrando por la columna 'nombre' de tu modelo
    if search:
        query = query.filter(Player.nombre.ilike(f"%{search}%"))
        
    players = query.all()
    
    resultado = []
    for p in players:
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