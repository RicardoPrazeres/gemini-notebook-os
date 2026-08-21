from fastapi import APIRouter, HTTPException
import uuid
import json
from datetime import datetime
from app.database import get_db
from app.services.studio_service import (
    generate_podcast_script,
    generate_mindmap,
    generate_flashcards,
    generate_briefing,
    generate_faq,
    generate_slide_deck,
    generate_video_storyboard
)

router = APIRouter(tags=["studio"])

@router.post("/api/notebooks/{notebook_id}/studio/{artifact_type}")
def generate_artifact(notebook_id: str, artifact_type: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, title FROM notebooks WHERE id = ?", (notebook_id,))
    notebook = cur.fetchone()
    conn.close()

    if not notebook:
        raise HTTPException(status_code=404, detail="Caderno não encontrado")

    result = {}
    title = ""

    if artifact_type == "podcast":
        result = generate_podcast_script(notebook_id)
        title = result.get("title", "🎙️ Audio Overview / Podcast")
    elif artifact_type == "mindmap":
        result = generate_mindmap(notebook_id)
        title = result.get("title", "🧠 Mapa Mental Conceitual")
    elif artifact_type == "flashcards":
        result = generate_flashcards(notebook_id)
        title = result.get("title", "🗂️ Flashcards de Estudo")
    elif artifact_type == "briefing":
        result = generate_briefing(notebook_id)
        title = result.get("title", "📄 Briefing Executivo")
    elif artifact_type == "faq":
        result = generate_faq(notebook_id)
        title = result.get("title", "❓ Perguntas Frequentes (FAQ)")
    elif artifact_type == "slides":
        result = generate_slide_deck(notebook_id)
        title = result.get("title", "📽️ Apresentação de Slides")
    elif artifact_type == "video":
        result = generate_video_storyboard(notebook_id)
        title = result.get("title", "🎬 Vídeo Explicativo IA")
    else:
        raise HTTPException(status_code=400, detail="Tipo de artefato inválido")

    # Save to studio_artifacts table
    artifact_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    content_data = json.dumps(result, ensure_ascii=False)

    conn = get_db()
    with conn:
        conn.execute("""
        INSERT INTO studio_artifacts (id, notebook_id, type, title, content_data, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (artifact_id, notebook_id, artifact_type, title, content_data, now))
    conn.close()

    return {
        "id": artifact_id,
        "notebook_id": notebook_id,
        "type": artifact_type,
        "title": title,
        "data": result,
        "created_at": now
    }

@router.get("/api/notebooks/{notebook_id}/artifacts")
def list_artifacts(notebook_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    SELECT id, notebook_id, type, title, content_data, created_at
    FROM studio_artifacts
    WHERE notebook_id = ?
    ORDER BY created_at DESC
    """, (notebook_id,))
    rows = cur.fetchall()
    conn.close()

    result = []
    for r in rows:
        item = dict(r)
        try:
            item["data"] = json.loads(item["content_data"])
        except Exception:
            item["data"] = item["content_data"]
        result.append(item)
    return result

@router.delete("/api/artifacts/{artifact_id}")
def delete_artifact(artifact_id: str):
    conn = get_db()
    with conn:
        cur = conn.execute("DELETE FROM studio_artifacts WHERE id = ?", (artifact_id,))
        if cur.rowcount == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="Artefato não encontrado")
    conn.close()
    return {"status": "deleted"}
