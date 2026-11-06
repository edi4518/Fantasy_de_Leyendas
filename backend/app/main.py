"""
Punto de entrada principal para el backend FastAPI de Fantasy de Leyendas PWA.
Expone la API del catálogo de jugadores, motor de simulación de partidos,
autenticación de mánagers y verificación de estado del servicio.
"""

import os
import unicodedata
from typing import List, Optional

from fastapi import FastAPI, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Configuración central y base de datos
from app.core.config import settings
from app.core.database import get_db
from app.models.player import Player
from app.models.user import User
from app.models.squad import UserPlayer, Plantilla, PlantillaJugador
from app.models.match import Partido, EventoPartido

# Routers de la aplicación
from app.api.routes import players, matches, analytics, squads, ranking
from app.api.routes.auth import router as auth_router

# Inicialización de la aplicación FastAPI
app = FastAPI(
    title="Fantasy de Leyendas API",
    description="API RESTful de Fantasy de Leyendas - Catálogo de 80 leyendas del fútbol histórico y motor de simulación 6v6",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# 1. Configuración robusta de CORS
origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

if hasattr(settings, "CORS_ORIGINS") and settings.CORS_ORIGINS:
    for origin in settings.CORS_ORIGINS:
        if origin not in origins:
            origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|.*\.vercel\.app)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def disable_static_js_cache(request: Request, call_next):
    """Evita que el navegador guarde en caché versiones antiguas de módulos JS o index.html."""
    response = await call_next(request)
    path = request.url.path
    if path == "/" or path.endswith(".js") or path.endswith(".html") or path in (
        "/onboarding", "/login", "/register", "/dashboard", "/matchmaking",
        "/market", "/comparison", "/lineup", "/history", "/ranking", "/profile", "/admin"
    ):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Manejador global de excepciones para garantizar que siempre se devuelva JSON válido con cabeceras CORS."""
    origin = request.headers.get("origin", "*")
    headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
    }
    return JSONResponse(
        status_code=500,
        content={"detail": f"Error interno en el servidor: {str(exc)}"},
        headers=headers,
    )


# 2. Servir estáticos locales para avatares y archivos subidos (con fallback a /tmp en entornos serverless)
UPLOAD_DIR = os.path.join("uploads", "avatars")
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
except Exception:
    UPLOAD_DIR = "/tmp/uploads/avatars"
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory="/tmp/uploads"), name="uploads")

# 3. Registrar routers modulares
app.include_router(auth_router)
app.include_router(squads.router, prefix="/api/squads", tags=["Squads"])
app.include_router(ranking.router, prefix="/api/ranking", tags=["Ranking"])
app.include_router(matches.router, prefix="/api/matches", tags=["Matches"])
app.include_router(players.router, prefix="/api/players", tags=["Players"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])

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


@app.get("/api/me", tags=["Manager Profile"])
def get_current_manager_profile(request: Request, db: Session = Depends(get_db)):
    """Retorna los datos de perfil y club del mánager autenticado desde la base de datos."""
    user = None
    auth_header = request.headers.get("Authorization", "")
    if "token_user_" in auth_header:
        try:
            uid = int(auth_header.split("token_user_")[-1].strip())
            user = db.query(User).filter(User.id == uid).first()
        except ValueError:
            pass

    if not user:
        user = db.query(User).order_by(User.id.desc()).first()

    if user:
        full_name = f"{user.nombre} {user.apellido}".strip()
        return {
            "id": user.id,
            "name": full_name,
            "username": user.username or full_name,
            "first_name": user.nombre,
            "last_name": user.apellido,
            "team_name": user.team_name,
            "email": user.email,
            "season": "Temporada 24 / 25",
            "ranking": user.elo_rating or 1000,
            "presupuesto": float(user.presupuesto if user.presupuesto is not None else 150.0),
            "partidos_jugados": user.partidos_jugados or 0,
            "victorias": user.victorias or 0,
            "empates": user.empates or 0,
            "derrotas": user.derrotas or 0,
            "goles_favor": user.goles_favor or 0,
            "goles_contra": user.goles_contra or 0,
            "preferences": {
                "notifications": bool(user.notif_activas if user.notif_activas is not None else True),
                "sounds": bool(user.sonido_activo if user.sonido_activo is not None else False),
            },
            "avatarUrl": f"{str(request.base_url).rstrip('/')}{user.photo_url}" if user.photo_url and user.photo_url.startswith("/") else user.photo_url,
        }

    return {
        "name": "Mánager Leyendas",
        "username": "Mánager Leyendas",
        "team_name": "Tu Equipo",
        "season": "Temporada 24 / 25",
        "ranking": 1000,
        "avatarUrl": None
    }


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    team_name: Optional[str] = None
    email: Optional[str] = None
    preferences: Optional[dict] = None


@app.put("/api/me", tags=["Manager Profile"])
@app.patch("/api/me", tags=["Manager Profile"])
def update_current_manager_profile(
    payload: UpdateProfileRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Actualiza el nombre, apellido y nombre del equipo del mánager en la tabla 'users' de MySQL."""
    user = None
    auth_header = request.headers.get("Authorization", "")
    if "token_user_" in auth_header:
        try:
            uid = int(auth_header.split("token_user_")[-1].strip())
            user = db.query(User).filter(User.id == uid).first()
        except ValueError:
            pass

    if not user:
        user = db.query(User).order_by(User.id.desc()).first()

    if not user:
        return {"status": "offline_fallback", "message": "Sin usuario registrado en BD"}

    if payload.first_name is not None and payload.first_name.strip():
        user.nombre = payload.first_name.strip()
    if payload.last_name is not None and payload.last_name.strip():
        user.apellido = payload.last_name.strip()
    if payload.team_name is not None and payload.team_name.strip():
        user.team_name = payload.team_name.strip()
    if payload.email is not None and payload.email.strip():
        user.email = payload.email.strip().lower()
    if payload.preferences and isinstance(payload.preferences, dict):
        if "notifications" in payload.preferences:
            user.notif_activas = bool(payload.preferences["notifications"])
        if "sounds" in payload.preferences:
            user.sonido_activo = bool(payload.preferences["sounds"])

    user.username = f"{user.nombre} {user.apellido}".strip()
    db.commit()
    db.refresh(user)

    return {
        "status": "updated",
        "id": user.id,
        "name": user.username,
        "username": user.username,
        "first_name": user.nombre,
        "last_name": user.apellido,
        "team_name": user.team_name,
        "email": user.email,
        "ranking": user.elo_rating or 1000,
        "presupuesto": float(user.presupuesto if user.presupuesto is not None else 100.0),
        "avatarUrl": f"http://127.0.0.1:8000{user.photo_url}" if user.photo_url and user.photo_url.startswith("/") else user.photo_url,
    }


@app.get("/api/players/catalog", tags=["Players Catalog"])
def get_players_catalog(
    search: str = Query(None, description="Buscar por nombre"),
    db: Session = Depends(get_db)
):
    """Endpoint alternativo del catálogo de leyendas con URLs de retratos optimizadas en Supabase."""
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
            "nombre": p.nombre,
            "position": p.posicion_base,
            "posicion_base": p.posicion_base,
            "position_detail": p.posicion_detalle,
            "posicion_detalle": p.posicion_detalle,
            "nationality": p.nacionalidad,
            "nacionalidad": p.nacionalidad,
            "price": getattr(p, "precio", 10.0),
            "precio": getattr(p, "precio", 10.0),
            "rating_attack": p.rating_ataque,
            "rating_creation": p.rating_creacion,
            "rating_technique": p.rating_tecnica,
            "rating_general": getattr(p, "rating_general", getattr(p, "media_juego", 85)),
            "media_juego": getattr(p, "media_juego", 85),
            "photo_url": f"{SUPABASE_STORAGE_URL}{slug}.webp",
            "image_filename": f"{slug}.webp"
        })

    return resultado


@app.get("/api/health", tags=["Health"])
@app.get("/health", tags=["Health"], include_in_schema=False)
def health_check(db: Session = Depends(get_db)):
    """Endpoint de verificación de estado y conexión activa con las 7 tablas en MySQL (puerto 3306)."""
    from app.core.database import engine
    db_url_str = str(engine.url.render_as_string(hide_password=True))
    return {
        "status": "ok",
        "database_engine": engine.dialect.name,
        "database_url": db_url_str,
        "port": engine.url.port or 3306,
        "database_name": engine.url.database,
        "tables": [
            "users",
            "players",
            "user_players",
            "plantillas",
            "plantilla_jugadores",
            "partidos",
            "eventos_partido",
        ],
        "counts": {
            "users": db.query(User).count(),
            "players": db.query(Player).count(),
            "user_players": db.query(UserPlayer).count(),
            "plantillas": db.query(Plantilla).count(),
            "plantilla_jugadores": db.query(PlantillaJugador).count(),
            "partidos": db.query(Partido).count(),
            "eventos_partido": db.query(EventoPartido).count(),
        },
    }


# 5. Servir Frontend estático (src/, public/ e index.html) cuando se despliega en Vercel o se accede a la raíz
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FRONTEND_SRC_DIR = os.path.join(PROJECT_ROOT, "src")
FRONTEND_PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")
FRONTEND_INDEX_HTML = os.path.join(FRONTEND_PUBLIC_DIR, "index.html")

if os.path.isdir(FRONTEND_SRC_DIR):
    app.mount("/src", StaticFiles(directory=FRONTEND_SRC_DIR), name="frontend_src")

if os.path.isdir(FRONTEND_PUBLIC_DIR):
    app.mount("/public", StaticFiles(directory=FRONTEND_PUBLIC_DIR), name="frontend_public")
    icons_dir = os.path.join(FRONTEND_PUBLIC_DIR, "icons")
    if os.path.isdir(icons_dir):
        app.mount("/icons", StaticFiles(directory=icons_dir), name="frontend_icons")


@app.get("/manifest.webmanifest", include_in_schema=False)
def serve_manifest():
    manifest_path = os.path.join(FRONTEND_PUBLIC_DIR, "manifest.webmanifest")
    if os.path.isfile(manifest_path):
        return FileResponse(manifest_path, media_type="application/manifest+json")
    return JSONResponse(status_code=404, content={"detail": "Not found"})


@app.get("/", include_in_schema=False)
@app.get("/index.html", include_in_schema=False)
@app.get("/onboarding", include_in_schema=False)
@app.get("/login", include_in_schema=False)
@app.get("/register", include_in_schema=False)
@app.get("/dashboard", include_in_schema=False)
@app.get("/matchmaking", include_in_schema=False)
@app.get("/market", include_in_schema=False)
@app.get("/comparison", include_in_schema=False)
@app.get("/lineup", include_in_schema=False)
@app.get("/history", include_in_schema=False)
@app.get("/ranking", include_in_schema=False)
@app.get("/profile", include_in_schema=False)
@app.get("/admin", include_in_schema=False)
@app.get("/match/{subpath:path}", include_in_schema=False)
def serve_spa_index():
    """Sirve el index.html de la PWA en la raíz y en todas las rutas del router SPA."""
    if os.path.isfile(FRONTEND_INDEX_HTML):
        return FileResponse(FRONTEND_INDEX_HTML, media_type="text/html")
    root_index = os.path.join(PROJECT_ROOT, "index.html")
    if os.path.isfile(root_index):
        return FileResponse(root_index, media_type="text/html")
    return JSONResponse(status_code=200, content={"status": "Fantasy de Leyendas API Online"})

