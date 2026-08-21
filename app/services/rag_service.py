import uuid
import re
import math
from collections import Counter
from app.database import get_db

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list:
    """Splits text into overlapping chunks, attempting to break at paragraphs/sentences."""
    if not text:
        return []
    
    # Split by double newlines first (paragraphs)
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""
    start_pos = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        
        if len(current_chunk) + len(para) + 2 <= chunk_size:
            current_chunk = f"{current_chunk}\n\n{para}".strip()
        else:
            if current_chunk:
                chunks.append({
                    "content": current_chunk,
                    "char_start": start_pos,
                    "char_end": start_pos + len(current_chunk)
                })
                start_pos += len(current_chunk) - overlap
                if start_pos < 0:
                    start_pos = 0
            
            # If paragraph itself is larger than chunk_size, split by sentences or hard slices
            if len(para) > chunk_size:
                words = para.split(" ")
                temp_chunk = ""
                for word in words:
                    if len(temp_chunk) + len(word) + 1 <= chunk_size:
                        temp_chunk = f"{temp_chunk} {word}".strip()
                    else:
                        if temp_chunk:
                            chunks.append({
                                "content": temp_chunk,
                                "char_start": start_pos,
                                "char_end": start_pos + len(temp_chunk)
                            })
                            start_pos += len(temp_chunk) - overlap
                        temp_chunk = word
                if temp_chunk:
                    current_chunk = temp_chunk
            else:
                current_chunk = para

    if current_chunk:
        chunks.append({
            "content": current_chunk,
            "char_start": start_pos,
            "char_end": start_pos + len(current_chunk)
        })

    return chunks

def save_source_chunks(source_id: str, notebook_id: str, text: str):
    """Generates and saves chunks into the database for a source."""
    chunks = chunk_text(text)
    conn = get_db()
    with conn:
        conn.execute("DELETE FROM source_chunks WHERE source_id = ?", (source_id,))
        for idx, ch in enumerate(chunks):
            conn.execute("""
            INSERT INTO source_chunks (id, source_id, notebook_id, chunk_index, content, char_start, char_end)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                str(uuid.uuid4()),
                source_id,
                notebook_id,
                idx,
                ch["content"],
                ch["char_start"],
                ch["char_end"]
            ))
    conn.close()

def tokenize(text: str) -> list:
    """Normalizes and extracts lowercase word tokens."""
    return re.findall(r'\b\w{2,}\b', text.lower())

def search_relevant_chunks(notebook_id: str, query: str, top_k: int = 8) -> list:
    """Hybrid TF-IDF / BM25 search to retrieve the most relevant chunks from active sources."""
    conn = get_db()
    cur = conn.cursor()

    # Fetch active sources for notebook
    cur.execute("""
    SELECT sc.id, sc.source_id, sc.chunk_index, sc.content, sc.char_start, sc.char_end, s.title as source_title
    FROM source_chunks sc
    JOIN sources s ON sc.source_id = s.id
    WHERE sc.notebook_id = ? AND s.is_active = 1
    """, (notebook_id,))
    
    rows = cur.fetchall()
    conn.close()

    if not rows:
        return []

    query_tokens = tokenize(query)
    if not query_tokens:
        # Return first few chunks if empty query
        return [dict(r) for r in rows[:top_k]]

    # Compute IDF across chunks
    doc_count = len(rows)
    df = Counter()
    doc_tokenized = []

    for r in rows:
        tokens = set(tokenize(r["content"] + " " + r["source_title"]))
        doc_tokenized.append((r, tokens, len(r["content"].split())))
        for t in tokens:
            df[t] += 1

    idf = {t: math.log((doc_count - df[t] + 0.5) / (df[t] + 0.5) + 1.0) for t in df}
    avg_dl = sum(d[2] for d in doc_tokenized) / (doc_count or 1)

    scored_chunks = []
    k1 = 1.5
    b = 0.75

    for r, tokens, doc_len in doc_tokenized:
        score = 0.0
        content_lower = (r["content"] + " " + r["source_title"]).lower()
        chunk_token_counts = Counter(tokenize(content_lower))

        for q_token in query_tokens:
            tf = chunk_token_counts.get(q_token, 0)
            if tf > 0:
                token_idf = idf.get(q_token, 0.1)
                bm25_tf = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc_len / avg_dl)))
                score += token_idf * bm25_tf

                # Extra boost if token is in the source title
                if q_token in r["source_title"].lower():
                    score += 1.5

        scored_chunks.append((score, dict(r)))

    # Sort by relevance score descending
    scored_chunks.sort(key=lambda x: x[0], reverse=True)

    # Return top_k results
    results = [item[1] for item in scored_chunks[:top_k]]
    return results

def build_grounded_context(notebook_id: str, query: str) -> tuple:
    """Builds numbered citation context blocks for grounding LLM generation."""
    chunks = search_relevant_chunks(notebook_id, query, top_k=6)
    
    if not chunks:
        # Fetch all active source summaries if search had no match
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id, title, content_text FROM sources WHERE notebook_id = ? AND is_active = 1", (notebook_id,))
        sources = cur.fetchall()
        conn.close()
        
        context_parts = []
        citations_map = {}
        for i, s in enumerate(sources):
            cite_num = i + 1
            excerpt = s["content_text"][:800]
            context_parts.append(f"[Fonte {cite_num}: {s['title']}]\n{excerpt}\n")
            citations_map[cite_num] = {
                "source_id": s["id"],
                "source_title": s["title"],
                "excerpt": excerpt
            }
        return "\n".join(context_parts), citations_map

    context_parts = []
    citations_map = {}

    for i, ch in enumerate(chunks):
        cite_num = i + 1
        excerpt = ch["content"].strip()
        context_parts.append(f"[Citação {cite_num} | Documento: '{ch['source_title']}']\n{excerpt}\n")
        citations_map[cite_num] = {
            "source_id": ch["source_id"],
            "source_title": ch["source_title"],
            "chunk_id": ch["id"],
            "excerpt": excerpt
        }

    formatted_context = "\n---\n".join(context_parts)
    return formatted_context, citations_map
