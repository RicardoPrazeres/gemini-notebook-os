from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import uuid
import os
import shutil
from datetime import datetime
from app.database import get_db
from app.config import UPLOADS_DIR
from app.parsers.pdf_parser import extract_text_from_pdf
from app.parsers.web_parser import extract_text_from_url
from app.parsers.youtube_parser import extract_text_from_youtube
from app.parsers.text_parser import extract_text_from_file
from app.services.rag_service import save_source_chunks

router = APIRouter(tags=["sources"])

class UrlSourceCreate(BaseModel):
    notebook_id: str
    url: str

class YouTubeSourceCreate(BaseModel):
    notebook_id: str
    url: str

class NoteSourceCreate(BaseModel):
    notebook_id: str
    title: str
    content: str

@router.get("/api/notebooks/{notebook_id}/sources")
def list_sources(notebook_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    SELECT id, notebook_id, title, type, original_path_or_url, char_count, is_active, created_at
    FROM sources
    WHERE notebook_id = ?
    ORDER BY created_at DESC
    """, (notebook_id,))
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("/api/notebooks/{notebook_id}/sources/upload")
async def upload_file_source(notebook_id: str, file: UploadFile = File(...)):
    source_id = str(uuid.uuid4())
    filename = file.filename or "documento"
    file_ext = os.path.splitext(filename)[1].lower()
    
    # Save file to uploads folder
    save_filename = f"{source_id}_{filename}"
    save_path = UPLOADS_DIR / save_filename
    
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Extract text based on file type
    content_text = ""
    source_type = "text"

    try:
        if file_ext == ".pdf":
            source_type = "pdf"
            content_text = extract_text_from_pdf(str(save_path))
        else:
            source_type = "markdown" if file_ext in [".md", ".markdown"] else "text"
            content_text = extract_text_from_file(str(save_path))
    except Exception as e:
        if os.path.exists(save_path):
            os.remove(save_path)
        raise HTTPException(status_code=400, detail=f"Erro ao processar o arquivo: {str(e)}")

    if not content_text.strip():
        content_text = f"Documento vazio: {filename}"

    now = datetime.now().isoformat()
    conn = get_db()
    with conn:
        conn.execute("""
        INSERT INTO sources (id, notebook_id, title, type, original_path_or_url, content_text, char_count, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        """, (source_id, notebook_id, filename, source_type, str(save_path), content_text, len(content_text), now))
        
        # Update notebook updated_at
        conn.execute("UPDATE notebooks SET updated_at = ? WHERE id = ?", (now, notebook_id))
    conn.close()

    # Index chunks
    save_source_chunks(source_id, notebook_id, content_text)

    return {"id": source_id, "title": filename, "type": source_type, "char_count": len(content_text)}

@router.post("/api/notebooks/{notebook_id}/sources/url")
def add_url_source(notebook_id: str, data: UrlSourceCreate):
    try:
        parsed = extract_text_from_url(data.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao acessar a URL: {str(e)}")

    source_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    content_text = parsed["content"]
    title = parsed["title"] or data.url

    conn = get_db()
    with conn:
        conn.execute("""
        INSERT INTO sources (id, notebook_id, title, type, original_path_or_url, content_text, char_count, is_active, created_at)
        VALUES (?, ?, ?, 'url', ?, ?, ?, 1, ?)
        """, (source_id, notebook_id, title, data.url, content_text, len(content_text), now))
        conn.execute("UPDATE notebooks SET updated_at = ? WHERE id = ?", (now, notebook_id))
    conn.close()

    save_source_chunks(source_id, notebook_id, content_text)
    return {"id": source_id, "title": title, "type": "url", "char_count": len(content_text)}

@router.post("/api/notebooks/{notebook_id}/sources/youtube")
def add_youtube_source(notebook_id: str, data: YouTubeSourceCreate):
    try:
        parsed = extract_text_from_youtube(data.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar vídeo do YouTube: {str(e)}")

    source_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    content_text = parsed["content"]
    title = parsed["title"]

    conn = get_db()
    with conn:
        conn.execute("""
        INSERT INTO sources (id, notebook_id, title, type, original_path_or_url, content_text, char_count, is_active, created_at)
        VALUES (?, ?, ?, 'youtube', ?, ?, ?, 1, ?)
        """, (source_id, notebook_id, title, data.url, content_text, len(content_text), now))
        conn.execute("UPDATE notebooks SET updated_at = ? WHERE id = ?", (now, notebook_id))
    conn.close()

    save_source_chunks(source_id, notebook_id, content_text)
    return {"id": source_id, "title": title, "type": "youtube", "char_count": len(content_text)}

@router.post("/api/notebooks/{notebook_id}/sources/note")
def add_note_source(notebook_id: str, data: NoteSourceCreate):
    source_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    content_text = data.content.strip()
    title = data.title.strip() or "Nota Rápida"

    conn = get_db()
    with conn:
        conn.execute("""
        INSERT INTO sources (id, notebook_id, title, type, original_path_or_url, content_text, char_count, is_active, created_at)
        VALUES (?, ?, ?, 'markdown', 'manual_note', ?, ?, 1, ?)
        """, (source_id, notebook_id, title, content_text, len(content_text), now))
        conn.execute("UPDATE notebooks SET updated_at = ? WHERE id = ?", (now, notebook_id))
    conn.close()

    save_source_chunks(source_id, notebook_id, content_text)
    return {"id": source_id, "title": title, "type": "markdown", "char_count": len(content_text)}

@router.patch("/api/sources/{source_id}/toggle")
def toggle_source(source_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT is_active FROM sources WHERE id = ?", (source_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Fonte não encontrada")
    
    new_state = 0 if row["is_active"] == 1 else 1
    with conn:
        conn.execute("UPDATE sources SET is_active = ? WHERE id = ?", (new_state, source_id))
    conn.close()
    return {"id": source_id, "is_active": new_state}

@router.get("/api/sources/{source_id}")
def get_source(source_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM sources WHERE id = ?", (source_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Fonte não encontrada")
    
    cur.execute("SELECT chunk_index, content FROM source_chunks WHERE source_id = ? ORDER BY chunk_index ASC", (source_id,))
    chunks = cur.fetchall()
    conn.close()

    res = dict(row)
    res["chunks"] = [dict(c) for c in chunks]
    return res

@router.delete("/api/sources/{source_id}")
def delete_source(source_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT original_path_or_url FROM sources WHERE id = ?", (source_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Fonte não encontrada")

    file_path = row["original_path_or_url"]
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    with conn:
        conn.execute("DELETE FROM sources WHERE id = ?", (source_id,))
    conn.close()
    return {"status": "deleted"}
