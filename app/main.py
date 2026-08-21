import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import init_db
from app.config import BASE_DIR
from app.routers import notebooks, sources, chat, studio, settings

# Initialize database on startup
init_db()

app = FastAPI(
    title="Gemini Notebook OS",
    description="Sistema Operacional de Conhecimento e IA Pessoal com Google Gemini e RAG Grounded",
    version="1.0.0"
)

# Enable CORS for flexible development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(notebooks.router)
app.include_router(sources.router)
app.include_router(chat.router)
app.include_router(studio.router)
app.include_router(settings.router)

# Mount static folder
static_dir = BASE_DIR / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Gemini Notebook OS", "version": "1.0.0"}

@app.get("/")
def serve_index():
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "Gemini Notebook OS API está ativa. Interface web em /static/index.html"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
