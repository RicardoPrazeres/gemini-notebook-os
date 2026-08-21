from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid
from datetime import datetime
from app.database import get_db

router = APIRouter(prefix="/api/notebooks", tags=["notebooks"])

class NotebookCreate(BaseModel):
    title: str
    description: str = ""
    icon: str = "📓"

class NotebookUpdate(BaseModel):
    title: str = None
    description: str = None
    icon: str = None

@router.get("")
def list_notebooks():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    SELECT n.*,
           (SELECT COUNT(*) FROM sources WHERE notebook_id = n.id) as source_count,
           (SELECT COUNT(*) FROM chat_messages WHERE notebook_id = n.id) as message_count,
           (SELECT COUNT(*) FROM studio_artifacts WHERE notebook_id = n.id) as artifact_count
    FROM notebooks n
    ORDER BY n.updated_at DESC
    """)
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("")
def create_notebook(data: NotebookCreate):
    notebook_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    conn = get_db()
    with conn:
        conn.execute("""
        INSERT INTO notebooks (id, title, description, icon, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (notebook_id, data.title.strip(), data.description.strip(), data.icon, now, now))
    conn.close()
    return {"id": notebook_id, "title": data.title, "description": data.description, "icon": data.icon}

@router.get("/{notebook_id}")
def get_notebook(notebook_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM notebooks WHERE id = ?", (notebook_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Caderno não encontrado")
    
    cur.execute("SELECT COUNT(*) as count, SUM(char_count) as total_chars FROM sources WHERE notebook_id = ?", (notebook_id,))
    stats = cur.fetchone()
    conn.close()
    
    result = dict(row)
    result["source_count"] = stats["count"]
    result["total_chars"] = stats["total_chars"] or 0
    return result

@router.put("/{notebook_id}")
def update_notebook(notebook_id: str, data: NotebookUpdate):
    conn = get_db()
    now = datetime.now().isoformat()
    updates = []
    params = []

    if data.title is not None:
        updates.append("title = ?")
        params.append(data.title.strip())
    if data.description is not None:
        updates.append("description = ?")
        params.append(data.description.strip())
    if data.icon is not None:
        updates.append("icon = ?")
        params.append(data.icon)

    if not updates:
        conn.close()
        return {"status": "no change"}

    updates.append("updated_at = ?")
    params.append(now)
    params.append(notebook_id)

    with conn:
        cur = conn.execute(f"UPDATE notebooks SET {', '.join(updates)} WHERE id = ?", params)
        if cur.rowcount == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="Caderno não encontrado")
    conn.close()
    return {"status": "updated"}

@router.delete("/{notebook_id}")
def delete_notebook(notebook_id: str):
    conn = get_db()
    with conn:
        cur = conn.execute("DELETE FROM notebooks WHERE id = ?", (notebook_id,))
        if cur.rowcount == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="Caderno não encontrado")
    conn.close()
    return {"status": "deleted"}
