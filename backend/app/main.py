"""
Punto de entrada principal para el backend FastAPI de Fantasy de Leyendas PWA.
Expone la API del catálogo de jugadores, motor de simulación de partidos,
autenticación de mánagers y verificación de estado del servicio.
"""

import base64
import os
import time
import unicodedata
from typing import List, Optional

from fastapi import FastAPI, Depends, Query, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles as BaseStaticFiles


class StaticFiles(BaseStaticFiles):
    """Extiende StaticFiles de FastAPI/Starlette para inyectar encabezados personalizados (ej. Cache-Control)."""

    def __init__(self, *args, headers: Optional[dict] = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.custom_headers = headers or {}

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        for key, value in self.custom_headers.items():
            response.headers[key] = value
        return response
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Configuración central y base de datos
from app.core.config import settings
from app.core.database import get_db
from app.core.security import resolve_authenticated_user
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
app.add_middleware(GZipMiddleware, minimum_size=500)


@app.middleware("http")
async def configure_html_route_cache(request: Request, call_next):
    """Permite BFCache en vistas SPA y asegura que Service Worker y HTML nunca queden atrapados en caché."""
    response = await call_next(request)
    path = request.url.path
    if (
        path
        in (
            "/",
            "/index.html",
            "/onboarding",
            "/login",
            "/register",
            "/dashboard",
            "/matchmaking",
            "/market",
            "/comparison",
            "/lineup",
            "/history",
            "/ranking",
            "/profile",
            "/admin",
        )
        or path.startswith("/match/")
    ):
        response.headers["Cache-Control"] = "no-cache, must-revalidate, max-age=0"
    elif path in ("/sw.js", "/public/sw.js"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers["Service-Worker-Allowed"] = "/"
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
    user = resolve_authenticated_user(request, db, allow_explicit=False)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
        )

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
        "ranking": max(0, user.elo_rating if user.elo_rating is not None else 1000),
        "elo_rating": max(0, user.elo_rating if user.elo_rating is not None else 1000),
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
        "avatarUrl": (
            user.photo_url
            if user.photo_url and (
                user.photo_url.startswith("data:image/")
                or user.photo_url.startswith("http://")
                or user.photo_url.startswith("https://")
            )
            else (
                f"{str(request.base_url).rstrip('/')}{user.photo_url}"
                if user.photo_url and user.photo_url.startswith("/")
                else user.photo_url
            )
        ),
    }


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    team_name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    preferences: Optional[dict] = None


@app.put("/api/me", tags=["Manager Profile"])
@app.patch("/api/me", tags=["Manager Profile"])
def update_current_manager_profile(
    payload: UpdateProfileRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Actualiza el nombre, apellido, nombre del equipo y avatar del mánager en la tabla 'users' de MySQL."""
    user = resolve_authenticated_user(request, db, allow_explicit=False)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
        )

    if payload.first_name is not None and payload.first_name.strip():
        user.nombre = payload.first_name.strip()
    if payload.last_name is not None and payload.last_name.strip():
        user.apellido = payload.last_name.strip()
    if payload.team_name is not None and payload.team_name.strip():
        user.team_name = payload.team_name.strip()
    if payload.email is not None and payload.email.strip():
        user.email = payload.email.strip().lower()
    if payload.avatar_url is not None and payload.avatar_url.strip():
        raw_avatar = payload.avatar_url.strip()
        if raw_avatar.startswith("data:image/") and "," in raw_avatar:
            # Persistir directamente en la base de datos para que sea resiliente
            # ante reinicios del disco efímero de Render o Vercel
            user.photo_url = raw_avatar
            try:
                header, encoded_b64 = raw_avatar.split(",", 1)
                ext = ".webp"
                if "png" in header:
                    ext = ".png"
                elif "jpeg" in header or "jpg" in header:
                    ext = ".jpg"
                safe_filename = f"user_{user.id}_avatar{ext}"
                disk_path = os.path.join(UPLOAD_DIR, safe_filename)
                with open(disk_path, "wb") as avatar_file:
                    avatar_file.write(base64.b64decode(encoded_b64))
            except Exception:
                pass
        else:
            user.photo_url = raw_avatar
    if payload.preferences and isinstance(payload.preferences, dict):
        if "notifications" in payload.preferences:
            user.notif_activas = bool(payload.preferences["notifications"])
        if "sounds" in payload.preferences:
            user.sonido_activo = bool(payload.preferences["sounds"])

    user.username = f"{user.nombre} {user.apellido}".strip()
    db.commit()
    db.refresh(user)

    base_origin = str(request.base_url).rstrip("/")
    return {
        "status": "updated",
        "id": user.id,
        "name": user.username,
        "username": user.username,
        "first_name": user.nombre,
        "last_name": user.apellido,
        "team_name": user.team_name,
        "email": user.email,
        "ranking": max(0, user.elo_rating if user.elo_rating is not None else 1000),
        "elo_rating": max(0, user.elo_rating if user.elo_rating is not None else 1000),
        "presupuesto": float(user.presupuesto if user.presupuesto is not None else 150.0),
        "avatarUrl": (
            user.photo_url
            if user.photo_url and (
                user.photo_url.startswith("data:image/")
                or user.photo_url.startswith("http://")
                or user.photo_url.startswith("https://")
            )
            else (
                f"{base_origin}{user.photo_url}"
                if user.photo_url and user.photo_url.startswith("/")
                else user.photo_url
            )
        ),
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
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

FRONTEND_SRC_DIR = (
    os.path.join(PROJECT_ROOT, "src")
    if os.path.isdir(os.path.join(PROJECT_ROOT, "src"))
    else os.path.join(BACKEND_ROOT, "src")
)

if os.path.isdir(os.path.join(PROJECT_ROOT, "public")):
    FRONTEND_PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")
elif os.path.isdir(os.path.join(BACKEND_ROOT, "static_public")):
    FRONTEND_PUBLIC_DIR = os.path.join(BACKEND_ROOT, "static_public")
else:
    FRONTEND_PUBLIC_DIR = os.path.join(BACKEND_ROOT, "public")

FRONTEND_INDEX_HTML = os.path.join(FRONTEND_PUBLIC_DIR, "index.html")

SRC_CACHE_HEADERS = {"Cache-Control": "public, max-age=0, must-revalidate"}
PUBLIC_CACHE_HEADERS = {"Cache-Control": "public, max-age=3600, must-revalidate"}
IMMUTABLE_CACHE_HEADERS = {"Cache-Control": "public, max-age=31536000, immutable"}
SW_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "Service-Worker-Allowed": "/",
}

if os.path.isdir(FRONTEND_SRC_DIR):
    app.mount(
        "/src",
        StaticFiles(directory=FRONTEND_SRC_DIR, html=True, headers=SRC_CACHE_HEADERS),
        name="src",
    )

if os.path.isdir(FRONTEND_PUBLIC_DIR):
    app.mount(
        "/public",
        StaticFiles(directory=FRONTEND_PUBLIC_DIR, html=True, headers=PUBLIC_CACHE_HEADERS),
        name="public",
    )
    icons_dir = os.path.join(FRONTEND_PUBLIC_DIR, "icons")
    if os.path.isdir(icons_dir):
        app.mount(
            "/icons",
            StaticFiles(directory=icons_dir, html=True, headers=IMMUTABLE_CACHE_HEADERS),
            name="frontend_icons",
        )
    images_dir = os.path.join(FRONTEND_PUBLIC_DIR, "images")
    if os.path.isdir(images_dir):
        app.mount(
            "/images",
            StaticFiles(directory=images_dir, html=True, headers=IMMUTABLE_CACHE_HEADERS),
            name="frontend_images",
        )


@app.get("/sw.js", include_in_schema=False)
@app.get("/public/sw.js", include_in_schema=False)
def serve_service_worker():
    """Sirve el Service Worker con cabeceras estrictas de no-cache para forzar actualización inmediata."""
    for candidate in (
        os.path.join(FRONTEND_PUBLIC_DIR, "sw.js"),
        os.path.join(PROJECT_ROOT, "public", "sw.js"),
        os.path.join(PROJECT_ROOT, "sw.js"),
    ):
        if os.path.isfile(candidate):
            return FileResponse(candidate, media_type="application/javascript", headers=SW_CACHE_HEADERS)
    return JSONResponse(status_code=404, content={"detail": "Service Worker not found"})


@app.get("/manifest.webmanifest", include_in_schema=False)
@app.get("/manifest.json", include_in_schema=False)
def serve_manifest():
    for candidate in (
        os.path.join(FRONTEND_PUBLIC_DIR, "manifest.webmanifest"),
        os.path.join(PROJECT_ROOT, "public", "manifest.webmanifest"),
        os.path.join(BACKEND_ROOT, "public", "manifest.webmanifest"),
    ):
        if os.path.isfile(candidate):
            return FileResponse(candidate, media_type="application/manifest+json", headers=PUBLIC_CACHE_HEADERS)
    return JSONResponse(status_code=404, content={"detail": "Manifest not found"})


@app.get("/apple-touch-icon.png", include_in_schema=False)
@app.get("/apple-touch-icon-precomposed.png", include_in_schema=False)
@app.get("/apple-touch-icon-180x180.png", include_in_schema=False)
@app.get("/apple-touch-icon-180x180-precomposed.png", include_in_schema=False)
def serve_apple_touch_icon():
    """Sirve el icono oficial de iOS con fondo sólido para pantalla de inicio."""
    for candidate in (
        os.path.join(PROJECT_ROOT, "apple-touch-icon.png"),
        os.path.join(BACKEND_ROOT, "apple-touch-icon.png"),
        os.path.join(FRONTEND_PUBLIC_DIR, "icons", "apple-touch-icon.png"),
        os.path.join(BACKEND_ROOT, "public", "icons", "apple-touch-icon.png"),
    ):
        if os.path.isfile(candidate):
            return FileResponse(candidate, media_type="image/png", headers=IMMUTABLE_CACHE_HEADERS)
    return JSONResponse(status_code=404, content={"detail": "Apple touch icon not found"})


@app.get("/favicon.ico", include_in_schema=False)
def serve_favicon():
    """Sirve el favicon.ico oficial para el navegador."""
    for candidate in (
        os.path.join(PROJECT_ROOT, "favicon.ico"),
        os.path.join(BACKEND_ROOT, "favicon.ico"),
        os.path.join(FRONTEND_PUBLIC_DIR, "favicon.ico"),
        os.path.join(BACKEND_ROOT, "public", "favicon.ico"),
    ):
        if os.path.isfile(candidate):
            return FileResponse(candidate, media_type="image/x-icon", headers=IMMUTABLE_CACHE_HEADERS)
    return JSONResponse(status_code=404, content={"detail": "Favicon not found"})


SPA_HTML_CACHE_HEADERS = {"Cache-Control": "no-cache, must-revalidate, max-age=0"}


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
    """Sirve el index.html de la PWA en la raíz y en todas las rutas del router SPA habilitando BFCache (sin no-store)."""
    candidates = [
        os.path.join(BACKEND_ROOT, "index.html"),
        os.path.join(PROJECT_ROOT, "index.html"),
        FRONTEND_INDEX_HTML,
        os.path.join(BACKEND_ROOT, "public", "index.html"),
        os.path.join(BACKEND_ROOT, "static_public", "index.html"),
    ]
    for c in candidates:
        if c and os.path.isfile(c):
            return FileResponse(c, media_type="text/html", headers=SPA_HTML_CACHE_HEADERS)
    return JSONResponse(status_code=200, content={"status": "Fantasy de Leyendas API Online"})

