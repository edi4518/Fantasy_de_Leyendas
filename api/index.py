import sys
import os

# Añadir directorio backend al PYTHONPATH para imports absolutos de app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.main import app
