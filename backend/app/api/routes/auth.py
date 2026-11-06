import os
import re
import shutil
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
import bcrypt
import httpx

from app.core.database import get_db
from app.models.user import User
from app.models.squad import Plantilla

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = "367906456287-h602ut2oho5r8c0q9cpa0epevsil3juo.apps.googleusercontent.com"

# Carpeta para almacenar los avatares subidos (con fallback a /tmp en entornos serverless)
UPLOAD_DIR = os.path.join("uploads", "avatars")
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except Exception:
    UPLOAD_DIR = "/tmp/uploads/avatars"
    os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============================================================================
# Schemas de respuesta y modelos de datos
# ============================================================================
class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str
    team_name: Optional[str] = None


# ============================================================================
# Funciones auxiliares de seguridad y formato
# ============================================================================
def hash_password(plain_password: str) -> str:
    """Genera un hash seguro para la contraseña con bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain_password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña ingresada coincide con el hash almacenado."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def parse_birthdate(raw_birthdate: Optional[str]) -> Optional[date]:
    """Convierte 'DD / MM / AAAA', 'DD/MM/YYYY' o 'YYYY-MM-DD' a datetime.date."""
    if not raw_birthdate:
        return None
    cleaned = raw_birthdate.strip()
    # Intento 1: DD / MM / YYYY o DD/MM/YYYY
    digits_parts = [p.strip() for p in re.split(r"[/\-]", cleaned) if p.strip()]
    if len(digits_parts) == 3:
        try:
            if len(digits_parts[0]) == 4:
                # YYYY-MM-DD
                return date(int(digits_parts[0]), int(digits_parts[1]), int(digits_parts[2]))
            else:
                # DD/MM/YYYY
                return date(int(digits_parts[2]), int(digits_parts[1]), int(digits_parts[0]))
        except ValueError:
            pass
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(cleaned.replace(" ", ""), fmt).date()
        except ValueError:
            continue
    return None


def serialize_user(user: User) -> dict:
    """Serializa el modelo User para el frontend incluyendo récord competitivo y preferencias."""
    full_name = f"{user.nombre} {user.apellido}".strip()
    return {
        "id": user.id,
        "username": user.username or full_name,
        "name": full_name,
        "first_name": user.nombre,
        "last_name": user.apellido,
        "team_name": user.team_name,
        "email": user.email,
        "rol": user.rol,
        "birthdate": user.fecha_nacimiento.strftime("%d / %m / %Y") if user.fecha_nacimiento else None,
        "profile_picture": user.photo_url,
        "photo_url": user.photo_url,
        "presupuesto": float(user.presupuesto if user.presupuesto is not None else 150.0),
        "elo_rating": user.elo_rating if user.elo_rating is not None else 1000,
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
    }


# ============================================================================
# 1. Endpoint: Registro de Nuevo Mánager (FormData / Multipart)
# ============================================================================
@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    first_name: str = Form(...),
    last_name: str = Form(...),
    team_name: str = Form(...),
    birthdate: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    profile_picture: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    normalized_email = email.strip().lower()
    first_name_clean = first_name.strip()
    last_name_clean = last_name.strip()
    team_name_clean = team_name.strip()

    # 1. Validaciones básicas de servidor
    if len(password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 6 caracteres.",
        )

    # 2. Verificar si el email ya existe en la base de datos
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electrónico ya está registrado.",
        )

    # 3. Manejo y almacenamiento de la foto de perfil opcional
    picture_path = None
    if profile_picture and profile_picture.filename:
        file_extension = os.path.splitext(profile_picture.filename)[1] or ".png"
        safe_filename = f"{normalized_email.replace('@', '_at_')}_avatar{file_extension}"
        disk_path = os.path.join(UPLOAD_DIR, safe_filename)

        with open(disk_path, "wb") as buffer:
            shutil.copyfileobj(profile_picture.file, buffer)

        picture_path = f"/{disk_path.replace(os.sep, '/')}"

    # 4. Hasheo seguro de la contraseña y conversión de fecha
    hashed_pwd = hash_password(password)
    parsed_birthdate = parse_birthdate(birthdate)

    # 5. Guardar en la tabla 'users' de la base de datos (MySQL / SQLite)
    new_user = User(
        username=f"{first_name_clean} {last_name_clean}".strip(),
        email=normalized_email,
        hashed_password=hashed_pwd,
        nombre=first_name_clean,
        apellido=last_name_clean,
        team_name=team_name_clean,
        rol="manager",
        fecha_nacimiento=parsed_birthdate,
        photo_url=picture_path,
        presupuesto=150.00,
        elo_rating=1000,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 6. Respuesta esperada por auth.js en el frontend
    return {
        "message": "Usuario registrado exitosamente en la base de datos",
        "access_token": f"token_user_{new_user.id}",
        "token_type": "bearer",
        "user": serialize_user(new_user),
    }


# ============================================================================
# 2. Endpoint: Inicio de Sesión (Login)
# ============================================================================
@router.post("/login", status_code=status.HTTP_200_OK)
async def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    normalized_email = credentials.email.strip().lower()

    user = db.query(User).filter(User.email == normalized_email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos. Por favor, inténtalo de nuevo.",
        )

    return {
        "message": "Inicio de sesión exitoso",
        "access_token": f"token_user_{user.id}",
        "token_type": "bearer",
        "user": serialize_user(user),
    }


# ============================================================================
# 3. Endpoint: Autenticación con Google OAuth (Login y Registro con Selección de Club)
# ============================================================================
@router.post("/google", status_code=status.HTTP_200_OK)
async def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Valida el token JWT de Google con Google TokenInfo y autentica o solicita creación de club."""
    credential = payload.credential.strip()
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token de Google requerido.",
        )

    # 1. Validar el token contra los servidores de Google (soporta ID Token y Access Token)
    token_data = None
    try:
        async with httpx.AsyncClient() as client:
            # Opción A: Intentar como ID Token (JWT emitido por Google Identity Services)
            resp = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}",
                timeout=12.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                aud = data.get("aud")
                if aud == GOOGLE_CLIENT_ID:
                    token_data = data
            
            # Opción B: Si no es ID Token, intentar como Access Token de Google OAuth
            if not token_data:
                resp_user = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {credential}"},
                    timeout=12.0,
                )
                if resp_user.status_code == 200:
                    token_data = resp_user.json()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"No se pudo conectar con los servidores de autenticación de Google: {str(e)}",
        )

    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de Google inválido o sesión expirada.",
        )

    email = (token_data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo obtener el correo de la cuenta de Google.",
        )

    first_name = (token_data.get("given_name") or token_data.get("name") or "Mánager").strip()
    last_name = (token_data.get("family_name") or "").strip()
    full_name = f"{first_name} {last_name}".strip()
    photo_url = token_data.get("picture")

    # 2. Verificar si el usuario ya existe en la base de datos
    user = db.query(User).filter(User.email == email).first()

    if user:
        # Actualizar foto de perfil si no tenía y Google la proporciona
        if photo_url and not user.photo_url:
            user.photo_url = photo_url
            db.commit()
            db.refresh(user)

        return {
            "message": "Inicio de sesión con Google exitoso",
            "access_token": f"token_user_{user.id}",
            "token_type": "bearer",
            "is_new_user": False,
            "user": serialize_user(user),
        }

    # 3. Usuario NUEVO: Si aún no eligió nombre de equipo, se lo pedimos al frontend mediante el pop-up
    if not payload.team_name or not payload.team_name.strip():
        return {
            "is_new_user": True,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "name": full_name,
            "photo_url": photo_url,
        }

    # 4. Usuario NUEVO con nombre de equipo elegido: Dar de alta en TiDB
    team_name_clean = payload.team_name.strip()
    sub_id = token_data.get("sub", email)
    placeholder_pwd = hash_password(f"google_oauth_{sub_id}_{email}")

    new_user = User(
        username=full_name,
        email=email,
        hashed_password=placeholder_pwd,
        nombre=first_name,
        apellido=last_name or first_name,
        team_name=team_name_clean,
        rol="manager",
        photo_url=photo_url,
        presupuesto=150.00,
        elo_rating=1000,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Crear la plantilla inicial del usuario
    plantilla = Plantilla(
        user_id=new_user.id,
        nombre=team_name_clean,
        formacion="1-2-2-1",
        costo_total=0.00,
        es_activa=True,
    )
    db.add(plantilla)
    db.commit()

    return {
        "message": "Registro con Google exitoso",
        "access_token": f"token_user_{new_user.id}",
        "token_type": "bearer",
        "is_new_user": False,
        "user": serialize_user(new_user),
    }


# ============================================================================
# 4. Endpoint: Listar usuarios registrados (Verificación de Base de Datos)
# ============================================================================
@router.get("/users", status_code=status.HTTP_200_OK)
def list_registered_users(db: Session = Depends(get_db)):
    """Devuelve la lista de mánagers registrados en la tabla 'users'."""
    users = db.query(User).order_by(User.id.desc()).all()
    return {
        "count": len(users),
        "users": [serialize_user(u) for u in users],
    }
