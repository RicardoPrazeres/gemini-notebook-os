import sqlite3
import json
import uuid
from datetime import datetime
from app.config import DB_PATH

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db()
    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS notebooks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            icon TEXT DEFAULT '📓',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sources (
            id TEXT PRIMARY KEY,
            notebook_id TEXT NOT NULL,
            title TEXT NOT NULL,
            type TEXT NOT NULL, -- 'pdf', 'url', 'youtube', 'text', 'markdown'
            original_path_or_url TEXT DEFAULT '',
            content_text TEXT NOT NULL,
            char_count INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS source_chunks (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL,
            notebook_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            char_start INTEGER DEFAULT 0,
            char_end INTEGER DEFAULT 0,
            FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
            FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            notebook_id TEXT NOT NULL,
            role TEXT NOT NULL, -- 'user', 'assistant'
            content TEXT NOT NULL,
            citations_json TEXT DEFAULT '[]',
            persona TEXT DEFAULT 'default',
            created_at TEXT NOT NULL,
            FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS studio_artifacts (
            id TEXT PRIMARY KEY,
            notebook_id TEXT NOT NULL,
            type TEXT NOT NULL, -- 'podcast', 'mindmap', 'flashcards', 'briefing', 'faq', 'timeline'
            title TEXT NOT NULL,
            content_data TEXT NOT NULL, -- JSON or Markdown string
            created_at TEXT NOT NULL,
            FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """)

        # Check if default starter notebook exists
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as count FROM notebooks")
        if cur.fetchone()["count"] == 0:
            starter_id = "default-starter"
            now = datetime.now().isoformat()
            cur.execute("""
            INSERT INTO notebooks (id, title, description, icon, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (
                starter_id,
                "🚀 Guia de Boas-Vindas ao Gemini Notebook OS",
                "Caderno inicial demonstrativo com exemplos de fontes, estudo e agentes.",
                "💡",
                now,
                now
            ))

            # Add a starter guide source
            starter_content = """# Bem-vindo ao Gemini Notebook OS!

O **Gemini Notebook OS** é o seu centro de comando inteligente para pesquisa, aprendizado e automação com modelos Google Gemini.

### Principais Capacidades:
1. **Knowledge Vault Multiformato:**
   - Adicione PDFs de livros, relatórios e artigos.
   - Cole links de artigos ou documentações da web.
   - Insira links de vídeos do YouTube para extrair transcrições e discutir os pontos-chave.
   - Escreva notas rápidas em Markdown ou texto livre.

2. **Chat Grounded (Sem Alucinações):**
   - O chat utiliza RAG (Retrieval-Augmented Generation) com citações numeradas [1], [2].
   - Ao clicar nas citações, você vê o trecho exato do documento original.
   - Escolha entre diferentes personas de IA (Pesquisador Crítico, Professor Didático, Estrategista SEO, Analista de Dados).

3. **Studio de Criação Automática:**
   - **Audio Overview (Podcast):** Gera uma conversa em áudio dinâmica com 2 apresentadores discutindo suas fontes.
   - **Mapas Mentais:** Cria diagramas visuais e conceituais do conteúdo.
   - **Flashcards & Guias de Estudo:** Gera cartões de memorização com teste prático.
   - **Briefing Executivo & FAQs:** Resume os tópicos mais cruciais para leitura rápida.

4. **Configuração da API:**
   - Você pode utilizar este sistema no modo de demonstração ou inserir sua chave gratuita do Google AI Studio em Configurações (ícone de engrenagem) para liberar o poder total do Gemini 2.0 Flash e 1.5 Pro.
"""
            source_id = str(uuid.uuid4())
            cur.execute("""
            INSERT INTO sources (id, notebook_id, title, type, original_path_or_url, content_text, char_count, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
            """, (
                source_id,
                starter_id,
                "Guia Oficial - Gemini Notebook OS.md",
                "markdown",
                "starter_guide.md",
                starter_content,
                len(starter_content),
                now
            ))

            # Starter chunks
            cur.execute("""
            INSERT INTO source_chunks (id, source_id, notebook_id, chunk_index, content, char_start, char_end)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                str(uuid.uuid4()),
                source_id,
                starter_id,
                0,
                starter_content,
                0,
                len(starter_content)
            ))

    conn.close()

def get_setting(key: str, default: str = "") -> str:
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cur.fetchone()
    conn.close()
    return row["value"] if row else default

def set_setting(key: str, value: str):
    conn = get_db()
    with conn:
        conn.execute("""
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """, (key, value))
    conn.close()
