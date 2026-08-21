# ✨ Gemini Notebook OS — Sistema Operacional de Conhecimento e IA Pessoal

Aplicação Full-Stack inspirada no conceito **"Gemini Notebook OS"** (popularizado por Julian Goldie a partir do Google NotebookLM / Gemini). Uma central unificada para transformar documentos, PDFs, artigos da web e vídeos em uma central inteligente de aprendizado e criação com IA.

---

## 🌟 Principais Recursos

### 1. 🗄️ Knowledge Vault (Fontes Multiformato)
- **Upload de Documentos:** Suporte nativo a PDFs, arquivos Markdown, TXT e CSV.
- **Páginas da Web:** Cole qualquer link de artigo ou documentação para extrair o conteúdo limpo sem anúncios.
- **Vídeos do YouTube:** Extração automática de metadados e transcrições completas com timestamps.
- **Notas Rápidas:** Editor com suporte total a formatação Markdown.
- **Controle Granular:** Ative e desative fontes individualmente para focar o contexto do chat.

### 2. 💬 Chat Grounded com RAG & Citações Estritas
- **Sem Alucinações:** Respostas ancoradas exclusivamente no conteúdo dos seus documentos.
- **Citações Clicáveis `[1]`, `[2]`:** Clique nos números no meio da resposta para inspecionar o trecho e a página exata do documento de origem.
- **Personas Especialistas:**
  - ✨ *Padrão*
  - 🔬 *Pesquisador Acadêmico*
  - 👨‍🏫 *Professor Didático (Feynman)*
  - 🚀 *Estrategista SEO & Conteúdo*
  - 📊 *Analista de Negócios*

### 3. 🎙️ Studio Multimídia & Audio Overview
- **Audio Overview (Podcast):** Gera uma conversa dinâmica com 2 apresentadores especialistas (**Alex** e **Sam**) dissecando suas fontes, com player integrado e sintetizador de vozes!
- **Mapas Mentais:** Diagramas conceituais visuais e navegáveis via Mermaid.js.
- **Flashcards 3D:** Cartões de estudo interativos com animação de flip e controle de dificuldade para repetição espaçada.
- **Briefing Executivo:** Relatório profissional com resumo, matriz de oportunidades e próximos passos.
- **Perguntas Frequentes (FAQ):** Respostas automáticas para as dúvidas mais relevantes do seu material.

### 4. 🔑 Suporte à API Gemini & Modo Demonstração
- **Pronto para Usar:** O sistema inclui um modo de demonstração inteligente para você testar tudo imediatamente, mesmo sem chave de API.
- **Conexão com Google AI Studio:** Insira sua chave de API gratuita no menu ⚙️ **Configurações** para liberar a velocidade do **Gemini 2.0 Flash** ou a profundidade do **Gemini 1.5 Pro**.

---

## 🚀 Como Executar

### 1. Inicialização Rápida (1 Clique no Mac/Linux)
Abra o Terminal nesta pasta e execute:
```bash
./start.sh
```
O script iniciará o servidor FastAPI e abrirá automaticamente o navegador em `http://localhost:8000`.

### 2. Execução Manual via Python
```bash
# Ativar o ambiente virtual
source .venv/bin/activate

# Iniciar o servidor
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Acesse no seu navegador: **[http://localhost:8000](http://localhost:8000)**

---

## 🔑 Como Obter a Chave da API Gemini (Gratuita)

1. Acesse o **[Google AI Studio](https://aistudio.google.com/app/apikey)** com sua conta Google.
2. Clique em **"Create API Key"** (Criar chave de API).
3. Copie a chave gerada.
4. No **Gemini Notebook OS**, clique no ícone ⚙️ no canto superior direito, cole sua chave e clique em **Salvar Configurações**.

---

## 📁 Estrutura do Projeto
```
Notbook Pessoal/
├── app/
│   ├── main.py                  # Ponto de entrada FastAPI
│   ├── config.py                # Configurações de caminhos e modelos
│   ├── database.py              # SQLite (cadernos, fontes, mensagens, artefatos)
│   ├── parsers/                 # Extratores de PDF, Web, YouTube e Textos
│   ├── services/
│   │   ├── rag_service.py       # Chunking, busca BM25 e citações
│   │   ├── gemini_service.py    # Motor Gemini 2.0/1.5 e modo demo
│   │   └── studio_service.py    # Geração de Podcasts, Mapas e Flashcards
│   └── routers/                 # Rotas da API REST
├── static/                      # Interface Web Completa (SPA)
│   ├── index.html               # Layout moderno estilo NotebookLM
│   ├── css/style.css            # Estilos Dark/Light e animações
│   └── js/                      # Controladores de UI, Chat, Audio e Studio
├── storage/                     # Banco SQLite local e uploads
├── start.sh                     # Script de inicialização
└── requirements.txt             # Dependências Python
```

---

## 🔒 Privacidade
Todos os seus dados, arquivos carregados e históricos de conversas ficam salvos localmente na pasta `storage/` da sua máquina.
