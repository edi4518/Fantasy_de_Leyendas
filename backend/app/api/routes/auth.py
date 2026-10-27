"""
Rutas de autenticación: registro, login con JWT y consulta de perfil propio.
"""

from fastapi import APIRouter

router = APIRouter()

@router.post("/register")
def register_user():
    """Registra a un nuevo usuario / manager."""
    return {"message": "Endpoint de registro de manager"}

@router.post("/login")
def login_user():
    """Autentica credenciales y emite un JWT access_token."""
    return {"message": "Endpoint de login"}

@router.get("/me")
def get_current_user_profile():
    """Retorna información del usuario autenticado."""
    return {"message": "Perfil de manager autenticado"}
