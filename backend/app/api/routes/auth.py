import os
import shutil
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, EmailStr
import bcrypt

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Carpeta para almacenar los avatares subidos
UPLOAD_DIR = os.path.join("uploads", "avatars")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============================================================================
# Schemas de respuesta y modelos de datos
# ============================================================================
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ============================================================================
# Funciones auxiliares de seguridad (Hashing de contraseñas)
# ============================================================================
def hash_password(plain_password: str) -> str:
    """Genera un hash seguro para la contraseña con bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain_password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña ingresada coincide con el hash almacenado."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


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
    profile_picture: Optional[UploadFile] = File(None)
):
    # 1. Validaciones básicas de servidor
    if len(password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 6 caracteres."
        )

    # 2. Manejo y almacenamiento de la foto de perfil opcional
    picture_path = None
    if profile_picture and profile_picture.filename:
        # Generar nombre de archivo único para evitar sobreescrituras
        file_extension = os.path.splitext(profile_picture.filename)[1]
        safe_filename = f"{email.replace('@', '_at_')}_avatar{file_extension}"
        picture_path = os.path.join(UPLOAD_DIR, safe_filename).replace("\\", "/")

        with open(picture_path, "wb") as buffer:
            shutil.copyfileobj(profile_picture.file, buffer)

    # 3. Hasheo seguro de la clave
    hashed_pwd = hash_password(password)

    # 4. Operación de Base de Datos (MySQL)
    # Aquí integras tu sesión con SQLAlchemy o tu repositorio:
    #
    # existing_user = db.query(User).filter(User.email == email).first()
    # if existing_user:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="El correo electrónico ya está registrado."
    #     )
    #
    # new_user = User(
    #     first_name=first_name,
    #     last_name=last_name,
    #     team_name=team_name,
    #     birthdate=birthdate,
    #     email=email,
    #     password_hash=hashed_pwd,
    #     profile_picture_url=picture_path
    # )
    # db.add(new_user)
    # db.commit()
    # db.refresh(new_user)

    # 5. Respuesta esperada por auth.js en el frontend
    return {
        "message": "Usuario registrado exitosamente",
        "access_token": "token_jwt_ejemplo",  # Sustituir por token JWT real al implementar security.py
        "token_type": "bearer",
        "user": {
            "first_name": first_name,
            "last_name": last_name,
            "team_name": team_name,
            "email": email,
            "profile_picture": picture_path
        }
    }


# ============================================================================
# 2. Endpoint: Inicio de Sesión (Login)
# ============================================================================
@router.post("/login", status_code=status.HTTP_200_OK)
async def login(credentials: LoginRequest):
    # 1. Consulta del usuario en base de datos
    # user = db.query(User).filter(User.email == credentials.email).first()
    # if not user or not verify_password(credentials.password, user.password_hash):
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="Correo o contraseña incorrectos. Por favor, inténtalo de nuevo."
    #     )

    # 2. Respuesta devuelta al frontend
    return {
        "message": "Inicio de sesión exitoso",
        "access_token": "token_jwt_ejemplo",
        "token_type": "bearer",
        "user": {
            "email": credentials.email
        }
    }