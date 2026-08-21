from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid
import json
from datetime import datetime
from app.database import get_db
from app.services.rag_service import build_grounded_context
from app.services.gemini_service import generate_grounded_response

router = APIRouter(tags=["chat"])

class ChatMessageRequest(BaseModel):
    message: str
    persona: str = "default"

@router.get("/api/notebooks/{notebook_id}/messages")
def get_chat_history(notebook_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    SELECT id, notebook_id, role, content, citations_json, persona, created_at
    FROM chat_messages
    WHERE notebook_id = ?
    ORDER BY created_at ASC
    """, (notebook_id,))
    rows = cur.fetchall()
    conn.close()

    result = []
    for r in rows:
        item = dict(r)
        try:
            item["citations"] = json.loads(item["citations_json"])
        except Exception:
            item["citations"] = []
        result.append(item)
    return result

@router.post("/api/notebooks/{notebook_id}/messages")
def send_chat_message(notebook_id: str, data: ChatMessageRequest):
    user_query = data.message.strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="A mensagem não pode estar vazia.")

    conn = get_db()
    cur = conn.cursor()
    
    # Verify notebook exists
    cur.execute("SELECT id FROM notebooks WHERE id = ?", (notebook_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Caderno não encontrado")

    # Fetch recent history
    cur.execute("""
    SELECT role, content FROM chat_messages 
    WHERE notebook_id = ? 
    ORDER BY created_at ASC LIMIT 10
    """, (notebook_id,))
    history = [dict(r) for r in cur.fetchall()]

    now = datetime.now().isoformat()
    user_msg_id = str(uuid.uuid4())
    
    # Save user message
    with conn:
        conn.execute("""
        INSERT INTO chat_messages (id, notebook_id, role, content, citations_json, persona, created_at)
        VALUES (?, ?, 'user', ?, '[]', ?, ?)
        """, (user_msg_id, notebook_id, user_query, data.persona, now))
    conn.close()

    # Build Grounded RAG Context
    context_text, citations_map = build_grounded_context(notebook_id, user_query)

    # Generate Response from Gemini / Demo Engine
    response_data = generate_grounded_response(
        notebook_id=notebook_id,
        user_query=user_query,
        context_text=context_text,
        citations_map=citations_map,
        persona=data.persona,
        history=history
    )

    assistant_msg_id = str(uuid.uuid4())
    assistant_now = datetime.now().isoformat()
    citations_json = json.dumps(response_data.get("citations", []))

    conn = get_db()
    with conn:
        conn.execute("""
        INSERT INTO chat_messages (id, notebook_id, role, content, citations_json, persona, created_at)
        VALUES (?, ?, 'assistant', ?, ?, ?, ?)
        """, (assistant_msg_id, notebook_id, response_data["content"], citations_json, data.persona, assistant_now))
    conn.close()

    return {
        "id": assistant_msg_id,
        "role": "assistant",
        "content": response_data["content"],
        "citations": response_data.get("citations", []),
        "persona": data.persona,
        "is_demo": response_data.get("is_demo", False),
        "model": response_data.get("model", "")
    }

@router.delete("/api/notebooks/{notebook_id}/messages")
def clear_chat_history(notebook_id: str):
    conn = get_db()
    with conn:
        conn.execute("DELETE FROM chat_messages WHERE notebook_id = ?", (notebook_id,))
    conn.close()
    return {"status": "cleared"}

@router.get("/api/notebooks/{notebook_id}/starter-prompts")
def get_starter_prompts(notebook_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT title FROM sources WHERE notebook_id = ? AND is_active = 1 LIMIT 5", (notebook_id,))
    sources = cur.fetchall()
    conn.close()

    if not sources:
        return [
            "Quais são os principais conceitos deste caderno?",
            "Faça um resumo executivo dos pontos fundamentais.",
            "Crie um guia de estudo rápido para iniciantes.",
            "Quais são as perguntas mais importantes a serem respondidas?"
        ]

    first_title = sources[0]["title"].split(".")[0]
    return [
        f"Faça um resumo aprofundado com foco em '{first_title}'",
        "Quais são os principais pontos práticos e conclusões das fontes?",
        "Compare as diferentes ideias apresentadas nos documentos.",
        "Crie 3 tópicos para discussão e próximos passos baseados neste material."
    ]
