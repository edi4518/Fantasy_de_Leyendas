"""
Módulo de seguridad criptográfica y gestión de tokens JWT (HS256).
Implementa creación y verificación de tokens seguros con firma HMAC-SHA256 y hashing de contraseñas con bcrypt,
con retrocompatibilidad absoluta para tokens legacy ('token_user_X').
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import time
from typing import Any, Dict, Optional
import bcrypt
from fastapi import Request
from sqlalchemy.orm import Session

logger = logging.getLogger("app.security")

# Clave secreta para la firma criptográfica HMAC-SHA256
JWT_SECRET = (
    os.getenv("JWT_SECRET")
    or os.getenv("SECRET_KEY")
    or "fantasy-de-leyendas-super-secret-production-key-2025"
)
JWT_EXPIRATION_SECONDS = 30 * 24 * 3600  # 30 días de validez


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    padding = 4 - (len(s) % 4)
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s.encode("utf-8"))


def hash_password(plain_password: str) -> str:
    """Genera hash seguro de contraseña usando bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plain_password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si una contraseña en texto plano coincide con su hash bcrypt."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: int, extra_claims: Optional[Dict[str, Any]] = None) -> str:
    """
    Genera un token JWT (RFC 7519) firmado con HMAC-SHA256.
    """
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + JWT_EXPIRATION_SECONDS,
    }
    if extra_claims:
        payload.update(extra_claims)

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_b64 = _b64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def decode_access_token(token: str) -> Optional[int]:
    """
    Verifica la firma criptográfica del JWT y retorna el user_id (sub) si es válido y no expiró.
    Retorna None si la firma no coincide o expiró.
    """
    try:
        parts = token.strip().split(".")
        if len(parts) != 3:
            return None

        header_b64, payload_b64, signature_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_sig = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
        provided_sig = _b64url_decode(signature_b64)

        if not hmac.compare_digest(expected_sig, provided_sig):
            return None

        payload_bytes = _b64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))

        exp = payload.get("exp")
        if exp and int(exp) < int(time.time()):
            return None

        user_id = payload.get("sub")
        if user_id:
            return int(user_id)
    except Exception as e:
        logger.debug(f"[Security] Fallo al decodificar token JWT: {e}")
        return None

    return None


def extract_user_id_from_header(auth_header: str) -> Optional[int]:
    """
    Extrae y valida el user_id desde el header Authorization ('Bearer <token>').
    Soporta:
      1. Tokens JWT firmados criptográficamente (HS256).
      2. Tokens legacy retrocompatibles ('token_user_X') para no desloguear a usuarios actuales.
    """
    if not auth_header:
        return None

    token = auth_header.strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()

    # 1. Intentar validar como JWT criptográfico
    if "." in token:
        uid = decode_access_token(token)
        if uid is not None:
            return uid

    # 2. Retrocompatibilidad: Si es token_user_X
    if "token_user_" in token:
        try:
            return int(token.split("token_user_")[-1].strip())
        except (ValueError, IndexError):
            pass

    return None


def resolve_authenticated_user(
    request: Request,
    db: Session,
    explicit_user_id: Optional[int] = None,
    allow_explicit: bool = False,
):
    """
    Resuelve el usuario de la base de datos a partir del header Authorization (JWT o legacy).
    Solo permite fallback a explicit_user_id si allow_explicit=True (consultas de solo lectura).
    """
    from app.models.user import User

    auth_header = request.headers.get("Authorization", "")
    uid = extract_user_id_from_header(auth_header)
    if uid is not None:
        user = db.query(User).filter(User.id == uid).first()
        if user:
            return user

    if allow_explicit and explicit_user_id:
        user = db.query(User).filter(User.id == explicit_user_id).first()
        if user:
            return user

    return None
