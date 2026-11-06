"""
Entrypoint raíz para Vercel (FastAPI Preset) y despliegues serverless.
Reexporta la instancia `app` de `backend/app/main.py`.
"""

import os
import sys
from fastapi import FastAPI

BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

app = FastAPI(title="Fantasy de Leyendas API")

from app.main import app as _backend_app  # noqa: E402

app = _backend_app

