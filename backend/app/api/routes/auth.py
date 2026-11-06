import os
import re
import shutil
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
import bcrypt

from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Carpeta para almacenar los avatares subidos
UPLOAD_DIR = os.path.join("uploads", "avatars")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============================================================================
# Schemas de respuesta y modelos de datos
# ============================================================================
class LoginRequest(BaseModel):
    email: str
    password: str


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
# 3. Endpoint: Listar usuarios registrados (Verificación de Base de Datos)
# ============================================================================
@router.get("/users", status_code=status.HTTP_200_OK)
def list_registered_users(db: Session = Depends(get_db)):
    """Devuelve la lista de mánagers registrados en la tabla 'users'."""
    users = db.query(User).order_by(User.id.desc()).all()
    return {
        "count": len(users),
        "users": [serialize_user(u) for u in users],
    }
