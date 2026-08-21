#!/usr/bin/env bash
cd "$(dirname "$0")"

# Check virtualenv
if [ ! -d ".venv" ]; then
    echo "⚙️ Criando ambiente virtual Python..."
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt
fi

echo "🚀 Iniciando Gemini Notebook OS em http://localhost:8000 ..."

# Open browser automatically if on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    (sleep 1.5 && open "http://localhost:8000") &
fi

# Run FastAPI backend with Uvicorn
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
