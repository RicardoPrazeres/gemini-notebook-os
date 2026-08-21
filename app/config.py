import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
DB_PATH = STORAGE_DIR / "notebooks.db"

# Ensure storage folders exist
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Default Gemini configuration
DEFAULT_MODEL = "gemini-2.0-flash"
AVAILABLE_MODELS = [
    {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash (Mais Rápido & Recente)", "badge": "Recomendado"},
    {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash (Ultrarrápido)", "badge": "Econômico"},
    {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro (Máximo Raciocínio & Contexto)", "badge": "Avançado"}
]
