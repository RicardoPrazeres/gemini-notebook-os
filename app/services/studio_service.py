import json
import requests
import re
from app.database import get_db, get_setting
from app.services.gemini_service import get_active_gemini_key, get_active_model

def get_notebook_sources_text(notebook_id: str, max_chars: int = 25000) -> str:
    """Collects text from all active sources in the notebook."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT title, content_text FROM sources WHERE notebook_id = ? AND is_active = 1", (notebook_id,))
    rows = cur.fetchall()
    conn.close()

    if not rows:
        return ""

    combined = []
    current_len = 0
    for r in rows:
        title = r["title"]
        text = r["content_text"][:8000]
        chunk = f"### Documento: {title}\n{text}\n"
        if current_len + len(chunk) > max_chars:
            break
        combined.append(chunk)
        current_len += len(chunk)

    return "\n---\n".join(combined)

def call_gemini_json_or_text(prompt: str, system_instruction: str = "") -> str:
    """Calls Gemini API for Studio artifact generation with fallback."""
    api_key = get_active_gemini_key()
    active_model = get_active_model().replace("models/", "")

    if api_key:
        candidate_models = [active_model, "gemini-2.0-flash", "gemini-1.5-flash-8b", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-pro"]
        unique_candidates = []
        for m in candidate_models:
            if m not in unique_candidates:
                unique_candidates.append(m)

        for model in unique_candidates:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                payload = {
                    "systemInstruction": {"parts": [{"text": system_instruction}]} if system_instruction else None,
                    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.5,
                        "maxOutputTokens": 4096
                    }
                }
                if not system_instruction:
                    del payload["systemInstruction"]

                res = requests.post(url, json=payload, timeout=40)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        return candidates[0]["content"]["parts"][0]["text"]
                elif res.status_code in [404, 400]:
                    continue
            except Exception as e:
                print(f"[Studio Gemini Request Error on {model}] {e}")

    return ""

def generate_podcast_script(notebook_id: str) -> dict:
    """Generates an Audio Overview / Podcast conversation between 2 hosts (Alex & Sam)."""
    sources_text = get_notebook_sources_text(notebook_id)
    if not sources_text:
        return {
            "title": "Podcast: Sem fontes disponíveis",
            "dialogue": [
                {"speaker": "Alex", "gender": "male", "text": "Olá! Parece que ainda não adicionamos nenhum documento ou fonte a este caderno."},
                {"speaker": "Sam", "gender": "female", "text": "Exatamente, Alex! Assim que você adicionar PDFs, links ou vídeos, faremos uma análise profunda em áudio para você."}
            ],
            "summary": "Adicione fontes ao caderno para gerar um podcast completo."
        }

    system_instruction = """Você é um produtor de podcasts de altíssimo nível no estilo "Audio Overview" do Google NotebookLM.
Sua missão é criar uma conversa natural, dinâmica e envolvente entre dois apresentadores especialistas:
- Alex (Voz Masculina): Entusiasmado, traz ótimos questionamentos, analogias e conecta os pontos práticos.
- Sam (Voz Feminina): Analítica, aprofunda os conceitos técnicos, traz dados e sintetiza as conclusões.

Retorne EXCLUSIVAMENTE um objeto JSON válido (sem tags markdown ```json adicionais) com a seguinte estrutura:
{
  "title": "Título criativo do episódio do podcast",
  "summary": "Breve resumo de 2 frases sobre o que foi discutido",
  "dialogue": [
    {
      "speaker": "Alex",
      "gender": "male",
      "text": "Fala de Alex em português com tom natural e conversacional..."
    },
    {
      "speaker": "Sam",
      "gender": "female",
      "text": "Resposta de Sam aprofundando o assunto..."
    }
  ]
}
Gere entre 6 a 12 turnos de diálogo dinâmicos abordando os principais tópicos das fontes fornecidas."""

    prompt = f"Crie um podcast envolvente baseado nas seguintes fontes do caderno:\n\n{sources_text}"
    raw_response = call_gemini_json_or_text(prompt, system_instruction)

    if raw_response:
        try:
            # Clean json fences if present
            cleaned = re.sub(r'^```(?:json)?\s*', '', raw_response.strip())
            cleaned = re.sub(r'\s*```$', '', cleaned)
            parsed = json.loads(cleaned)
            return parsed
        except Exception:
            pass

    # Fallback podcast generator for demo mode
    lines = sources_text.splitlines()
    key_topics = [l.strip("#- *") for l in lines if len(l.strip()) > 10 and not l.startswith("http")][:4]
    topic1 = key_topics[0] if len(key_topics) > 0 else "os temas centrais deste caderno"
    topic2 = key_topics[1] if len(key_topics) > 1 else "as principais aplicações práticas"

    return {
        "title": "Deep Dive: Explorando suas Fontes",
        "summary": "Uma discussão fluida e objetiva cobrindo os conceitos-chave, desafios e conclusões extraídas dos seus documentos.",
        "dialogue": [
            {
                "speaker": "Alex",
                "gender": "male",
                "text": f"Olá a todos! Sejam muito bem-vindos a este episódio especial. Hoje vamos dissecar um material muito interessante focado em {topic1}."
            },
            {
                "speaker": "Sam",
                "gender": "female",
                "text": f"É verdade, Alex! Quando analisei as fontes que o usuário carregou, o que mais me chamou atenção foi a clareza sobre {topic2}."
            },
            {
                "speaker": "Alex",
                "gender": "male",
                "text": "Exatamente. O ponto fundamental aqui é como todas essas partes se conectam para gerar um aprendizado muito mais rápido e sem sobrecarga de informação."
            },
            {
                "speaker": "Sam",
                "gender": "female",
                "text": "Sem dúvida. Além disso, o Gemini Notebook OS permite que você faça perguntas diretamente no chat e obtenha citações diretas de cada parágrafo relevante."
            },
            {
                "speaker": "Alex",
                "gender": "male",
                "text": "Sensacional! Fiquem à vontade para explorar os outros geradores do Studio, como Mapas Mentais e Flashcards. Até a próxima!"
            }
        ]
    }

def generate_mindmap(notebook_id: str) -> dict:
    """Generates a structured Mind Map in Mermaid format and JSON node hierarchy."""
    sources_text = get_notebook_sources_text(notebook_id)
    if not sources_text:
        return {
            "title": "Mapa Mental - Vazio",
            "mermaid": "graph TD\n    A[Caderno Vazio] --> B[Adicione fontes no painel esquerdo]",
            "topics": []
        }

    system_instruction = """Você é um arquiteto de mapas mentais e estruturação de conhecimento.
Gere um mapa mental claro a partir dos documentos fornecidos.
Retorne EXCLUSIVAMENTE um objeto JSON válido com a estrutura:
{
  "title": "Título do Mapa Mental",
  "mermaid": "graph TD\\n    Central[Conceito Central] --> Sub1[Tópico 1]\\n    Central --> Sub2[Tópico 2]\\n    Sub1 --> Det1[Detalhe 1A]\\n    Sub1 --> Det2[Detalhe 1B]\\n    Sub2 --> Det3[Detalhe 2A]",
  "topics": [
    {"name": "Tópico 1", "details": ["Item 1", "Item 2"]},
    {"name": "Tópico 2", "details": ["Item 3", "Item 4"]}
  ]
}
Certifique-se de que a sintaxe Mermaid seja 100% válida, sem caracteres proibidos como aspas internas não tratadas."""

    prompt = f"Gere o mapa mental a partir destas fontes:\n\n{sources_text}"
    raw_response = call_gemini_json_or_text(prompt, system_instruction)

    if raw_response:
        try:
            cleaned = re.sub(r'^```(?:json)?\s*', '', raw_response.strip())
            cleaned = re.sub(r'\s*```$', '', cleaned)
            return json.loads(cleaned)
        except Exception:
            pass

    # Fallback Mind Map
    return {
        "title": "Estrutura Conceitual do Caderno",
        "mermaid": """graph TD
    Root["🧠 Conhecimento Central"] --> Sec1["📚 Fontes Ingeridas"]
    Root --> Sec2["💬 Chat Grounded"]
    Root --> Sec3["🎙️ Studio de Criação"]
    Sec1 --> S1A["PDFs e Textos"]
    Sec1 --> S1B["YouTube e Web"]
    Sec2 --> S2A["Citações [1], [2]"]
    Sec2 --> S2B["Personas Especialistas"]
    Sec3 --> S3A["Podcast Áudio"]
    Sec3 --> S3B["Flashcards & Mapas"]""",
        "topics": [
            {"name": "Fontes Ingeridas", "details": ["PDFs", "Artigos Web", "Vídeos do YouTube"]},
            {"name": "Chat Grounded", "details": ["RAG sem alucinações", "Citações verificáveis", "Multi-Personas"]},
            {"name": "Studio de Criação", "details": ["Podcast com 2 apresentadores", "Flashcards", "Mapas Mentais"]}
        ]
    }

def generate_flashcards(notebook_id: str) -> dict:
    """Generates study flashcards with questions, answers, and category tags."""
    sources_text = get_notebook_sources_text(notebook_id)
    if not sources_text:
        return {"title": "Flashcards", "cards": []}

    system_instruction = """Você é um especialista em ciência do aprendizado e repetição espaçada (spaced repetition).
Crie cartões de estudo (flashcards) envolventes e desafiadores baseados no conteúdo fornecido.
Retorne EXCLUSIVAMENTE um objeto JSON válido com a estrutura:
{
  "title": "Coleção de Flashcards de Estudo",
  "cards": [
    {
      "id": 1,
      "category": "Conceito Principal",
      "question": "Pergunta clara sobre o conceito?",
      "answer": "Resposta concisa e explicativa.",
      "difficulty": "Fácil / Médio / Difícil"
    }
  ]
}
Gere entre 5 a 10 flashcards de alta qualidade."""

    prompt = f"Gere flashcards a partir destas fontes:\n\n{sources_text}"
    raw_response = call_gemini_json_or_text(prompt, system_instruction)

    if raw_response:
        try:
            cleaned = re.sub(r'^```(?:json)?\s*', '', raw_response.strip())
            cleaned = re.sub(r'\s*```$', '', cleaned)
            return json.loads(cleaned)
        except Exception:
            pass

    # Fallback Flashcards
    return {
        "title": "Flashcards Essenciais do Caderno",
        "cards": [
            {
                "id": 1,
                "category": "Fundamentos",
                "question": "O que é o conceito de 'Notebook OS' apresentado no Gemini Notebook?",
                "answer": "É uma central unificada que combina ingestão de múltiplas fontes com agentes de IA, RAG com citações estritas e um estúdio de geração automática de conteúdo.",
                "difficulty": "Fácil"
            },
            {
                "id": 2,
                "category": "Tecnologia",
                "question": "Como o Chat Grounded evita alucinações da IA?",
                "answer": "O sistema ancora as respostas estritamente nos trechos de documentos fornecidos e associa números de citação verificáveis [1], [2] a cada afirmação.",
                "difficulty": "Médio"
            },
            {
                "id": 3,
                "category": "Recursos",
                "question": "Quais formatos de fontes podem ser importados no Knowledge Vault?",
                "answer": "Documentos PDF, arquivos de texto/Markdown, páginas da Web via URL e transcrições de vídeos do YouTube.",
                "difficulty": "Fácil"
            },
            {
                "id": 4,
                "category": "Studio",
                "question": "Como funciona o gerador de Audio Overview / Podcast?",
                "answer": "Ele gera um diálogo dinâmico entre dois hosts (Alex e Sam) sintetizando os pontos-chave dos seus documentos em uma experiência de escuta imersiva.",
                "difficulty": "Médio"
            }
        ]
    }

def generate_briefing(notebook_id: str) -> dict:
    """Generates an executive briefing and summary document."""
    sources_text = get_notebook_sources_text(notebook_id)
    if not sources_text:
        return {
            "title": "Briefing Executivo",
            "content": "# Briefing Executivo\n\nNenhuma fonte ativa encontrada. Adicione documentos para gerar o briefing."
        }

    system_instruction = """Você é um Consultor Executivo de Estratégia.
Gere um Relatório de Briefing Executivo detalhado, profissional e com excelente formatação Markdown.
Inclua:
1. 🎯 **Resumo Executivo (Executive Summary)**
2. 🔑 **Principais Descobertas e Pontos Críticos**
3. 📊 **Tabela de Oportunidades & Riscos**
4. 🚀 **Plano de Ação Recomendado (Next Steps)**
5. 💡 **Conclusão Estratégica**"""

    prompt = f"Gere o briefing executivo com base nas seguintes fontes:\n\n{sources_text}"
    raw_response = call_gemini_json_or_text(prompt, system_instruction)

    if raw_response:
        return {
            "title": "Relatório de Briefing Executivo",
            "content": raw_response
        }

    # Fallback Briefing
    return {
        "title": "Relatório de Briefing Executivo",
        "content": f"""# 📄 Relatório de Briefing Executivo

## 1. 🎯 Resumo Executivo
Este documento consolida as principais informações e orientações extraídas do material carregado no **Gemini Notebook OS**. O objetivo é fornecer uma visão clara, estruturada e de alto impacto para tomada de decisão e aprendizado rápido.

---

## 2. 🔑 Principais Pilares Identificados
- **Centralização de Conhecimento:** Eliminação da fragmentação de informações através de um repositório único de fontes multiformato.
- **Precisão e Citações:** Garantia de respostas baseadas em dados fáticos e rastreáveis até os documentos originais.
- **Multi-Formato de Entrega:** Capacidade de consumir conhecimento através de texto, áudio podcast, diagramas visuais e flashcards de fixação.

---

## 3. 📊 Matriz de Oportunidades e Ações

| Dimensão | Oportunidade Identificada | Ação Recomendada |
| :--- | :--- | :--- |
| **Pesquisa** | Acelerar síntese de relatórios e PDFs extensos | Ingerir os documentos e solicitar resumos temáticos |
| **Multimídia** | Consumir transcrições de vídeos e artigos web | Utilizar a ingestão de URLs e o player de Podcast |
| **Retenção** | Fixação de conhecimento e estudos | Praticar com o deck de Flashcards interativos |

---

## 4. 🚀 Próximos Passos
1. Adicione documentos adicionais ao seu caderno temático.
2. Utilize o chat com diferentes personas para explorar ângulos complementares.
3. Exporte os artefatos gerados para seu fluxo diário de trabalho.
"""
    }

def generate_faq(notebook_id: str) -> dict:
    """Generates a Frequently Asked Questions (FAQ) document."""
    sources_text = get_notebook_sources_text(notebook_id)
    if not sources_text:
        return {"title": "Perguntas Frequentes (FAQ)", "faqs": []}

    system_instruction = """Você é um especialista em síntese de conhecimento.
Gere uma lista de 5 a 8 Perguntas Frequentes (FAQs) com respostas detalhadas e esclarecedoras a partir dos documentos.
Retorne EXCLUSIVAMENTE um objeto JSON válido com a estrutura:
{
  "title": "Perguntas Frequentes (FAQ)",
  "faqs": [
    {
      "question": "Pergunta frequente?",
      "answer": "Resposta explicativa e completa."
    }
  ]
}"""

    prompt = f"Gere o FAQ a partir destas fontes:\n\n{sources_text}"
    raw_response = call_gemini_json_or_text(prompt, system_instruction)

    if raw_response:
        try:
            cleaned = re.sub(r'^```(?:json)?\s*', '', raw_response.strip())
            cleaned = re.sub(r'\s*```$', '', cleaned)
            return json.loads(cleaned)
        except Exception:
            pass

    # Fallback FAQ
    return {
        "title": "Perguntas Frequentes (FAQ)",
        "faqs": [
            {
                "question": "Qual é a principal vantagem de usar o Gemini Notebook OS?",
                "answer": "A capacidade de transformar documentos estáticos e vídeos em um sistema interativo com chat grounded (sem alucinações), podcasts em áudio, mapas mentais e cartões de memorização."
            },
            {
                "question": "Como posso conectar minha chave de API do Gemini?",
                "answer": "Clique no ícone de engrenagem ⚙️ no menu superior ou lateral, acesse o link gratuito do Google AI Studio para gerar sua chave e cole-a no campo correspondente."
            },
            {
                "question": "O sistema funciona offline ou em modo demonstração?",
                "answer": "Sim! O sistema possui um motor inteligente de demonstração e armazenamento SQLite 100% local no seu computador."
            }
        ]
    }

def generate_slide_deck(notebook_id: str) -> dict:
    """Generates an executive presentation slide deck from notebook sources."""
    sources_text = get_notebook_sources_text(notebook_id)
    if not sources_text:
        return {
            "title": "Apresentação: Sem fontes",
            "slides": [
                {
                    "type": "title",
                    "title": "Apresentação de Slides",
                    "subtitle": "Adicione fontes no painel esquerdo para gerar seus slides.",
                    "bullets": [],
                    "notes": "Notas do apresentador aparecerão aqui."
                }
            ]
        }

    system_instruction = """Você é um designer de apresentações executivas e mestre em storytelling corporativo (Keynote/PowerPoint style).
Crie uma apresentação de slides de alto impacto baseada nas fontes fornecidas.
Retorne EXCLUSIVAMENTE um objeto JSON válido com a seguinte estrutura:
{
  "title": "Título Principal da Apresentação",
  "subtitle": "Subtítulo estratégico da apresentação",
  "slides": [
    {
      "slide_number": 1,
      "type": "title",
      "title": "Título do Slide de Abertura",
      "subtitle": "Subtítulo impactante",
      "bullets": [],
      "notes": "Notas do apresentador para o primeiro slide."
    },
    {
      "slide_number": 2,
      "type": "content",
      "title": "Visão Geral & Contexto",
      "subtitle": "Fundamentos essenciais",
      "bullets": [
        "Ponto chave 1 explicado com clareza",
        "Ponto chave 2 com dados ou métricas",
        "Ponto chave 3 com aplicação prática"
      ],
      "notes": "Enfatizar o contraste entre a abordagem tradicional e a nova proposta."
    }
  ]
}
Gere entre 5 a 8 slides estruturados (Capa, Problema/Contexto, Pilares Principais, Detalhes Práticos, Resultados/Oportunidades, Conclusão/Próximos Passos)."""

    prompt = f"Gere a apresentação de slides com base nestas fontes:\n\n{sources_text}"
    raw_response = call_gemini_json_or_text(prompt, system_instruction)

    if raw_response:
        try:
            cleaned = re.sub(r'^```(?:json)?\s*', '', raw_response.strip())
            cleaned = re.sub(r'\s*```$', '', cleaned)
            return json.loads(cleaned)
        except Exception:
            pass

    # Fallback Slide Deck
    return {
        "title": "Apresentação Executiva: Síntese de Conhecimento",
        "subtitle": "Estratégia e Insights Gerados pelo Gemini Notebook OS",
        "slides": [
            {
                "slide_number": 1,
                "type": "title",
                "title": "Gemini Notebook OS",
                "subtitle": "Transformando Documentos em um Centro de Comando Inteligente",
                "bullets": [],
                "notes": "Boas-vindas à audiência e introdução ao propósito da apresentação."
            },
            {
                "slide_number": 2,
                "type": "content",
                "title": "1. O Desafio da Sobrecarga de Informação",
                "subtitle": "Fragmentação e perda de tempo",
                "bullets": [
                    "Documentos, PDFs e vídeos dispersos em múltiplas plataformas.",
                    "Dificuldade em encontrar respostas rápidas e confiáveis.",
                    "Risco de alucinações em IAs genéricas não ancoradas em fontes."
                ],
                "notes": "Destacar como profissionais perdem até 20% do tempo procurando dados internos."
            },
            {
                "slide_number": 3,
                "type": "content",
                "title": "2. A Solução: Arquitetura Grounded RAG",
                "subtitle": "Precisão absoluta com citações verificáveis",
                "bullets": [
                    "Ingestão multiformato: PDFs, URLs da Web e vídeos do YouTube.",
                    "Indexação semântica local em chunks com busca BM25 híbrida.",
                    "Citações diretas e clicáveis [1], [2] diretamente no texto original."
                ],
                "notes": "Explicar a importância da rastreabilidade e integridade das respostas."
            },
            {
                "slide_number": 4,
                "type": "content",
                "title": "3. O Studio Multimídia de Criação",
                "subtitle": "Vários formatos a partir do mesmo conhecimento",
                "bullets": [
                    "Audio Overview: Podcasts com 2 vozes sintetizadas (Alex & Sam).",
                    "Apresentações de Slides e Vídeos Narrados instantâneos.",
                    "Mapas Mentais visuais e Flashcards 3D de repetição espaçada."
                ],
                "notes": "Mostrar a versatilidade de adaptar o conteúdo para diferentes estilos de aprendizado."
            },
            {
                "slide_number": 5,
                "type": "content",
                "title": "4. Próximos Passos & Implementação",
                "subtitle": "Como aplicar no fluxo de trabalho diário",
                "bullets": [
                    "Carregar a base de conhecimento específica da sua área.",
                    "Personalizar com personas de IA (Pesquisador, Professor, SEO, Analista).",
                    "Exportar artefatos gerados para reuniões e estudos."
                ],
                "notes": "Finalizar com chamada para ação clara e abertura para perguntas."
            }
        ]
    }

def generate_video_storyboard(notebook_id: str) -> dict:
    """Generates an animated AI Video Storyboard with narrated scenes and subtitles."""
    sources_text = get_notebook_sources_text(notebook_id)
    if not sources_text:
        return {
            "title": "Vídeo: Sem fontes",
            "summary": "Adicione fontes para criar o vídeo narrado.",
            "scenes": [
                {
                    "scene_number": 1,
                    "heading": "Vídeo Resumo",
                    "narration": "Adicione documentos no painel de fontes para gerar seu vídeo inteligente com narração e legendas.",
                    "visual_cue": "✨ Central de Conhecimento",
                    "duration_sec": 6,
                    "bg_gradient": "gradient-1"
                }
            ]
        }

    system_instruction = """Você é um diretor de vídeos explicativos e criador de Motion Graphics (estilo Vox/YouTube Explainer).
Crie um roteiro de vídeo dinâmico, visual e com narração fluida baseado nas fontes do caderno.
Retorne EXCLUSIVAMENTE um objeto JSON válido com a seguinte estrutura:
{
  "title": "Título do Vídeo Explicativo",
  "summary": "Resumo de 1 frase do vídeo",
  "total_duration_sec": 45,
  "scenes": [
    {
      "scene_number": 1,
      "heading": "Gancho Inicial (Hook)",
      "narration": "Texto fluido e envolvente que será lido pelo narrador em português...",
      "visual_cue": "💡 Ideia Principal em Destaque",
      "bullet": "Sub-tópico de suporte",
      "duration_sec": 8,
      "bg_gradient": "gradient-1"
    }
  ]
}
Gere entre 4 a 6 cenas dinâmicas e impactantes com duração de 6 a 10 segundos cada."""

    prompt = f"Gere o roteiro do vídeo explicativo baseado nestas fontes:\n\n{sources_text}"
    raw_response = call_gemini_json_or_text(prompt, system_instruction)

    if raw_response:
        try:
            cleaned = re.sub(r'^```(?:json)?\s*', '', raw_response.strip())
            cleaned = re.sub(r'\s*```$', '', cleaned)
            return json.loads(cleaned)
        except Exception:
            pass

    # Fallback Video Storyboard
    return {
        "title": "Vídeo Explicativo: Dominando suas Fontes",
        "summary": "Um resumo audiovisual dinâmico apresentando os conceitos essenciais do seu caderno.",
        "total_duration_sec": 38,
        "scenes": [
            {
                "scene_number": 1,
                "heading": "🚀 Bem-vindo ao Gemini Notebook OS",
                "narration": "Imagine ter todos os seus PDFs, artigos da web e vídeos organizados em um único centro de comando inteligente.",
                "visual_cue": "📚 Centralização Inteligente de Conhecimento",
                "bullet": "Todas as suas fontes em um único ambiente seguro.",
                "duration_sec": 7,
                "bg_gradient": "gradient-1"
            },
            {
                "scene_number": 2,
                "heading": "🎯 RAG com Citações Diretas",
                "narration": "Chega de alucinações. Cada resposta da IA é ancorada estritamente nos trechos originais dos seus documentos com citações verificáveis.",
                "visual_cue": "🔍 Respostas Baseadas em Fatos e Dados",
                "bullet": "Citações [1], [2] com clique direto no parágrafo original.",
                "duration_sec": 8,
                "bg_gradient": "gradient-2"
            },
            {
                "scene_number": 3,
                "heading": "🎙️ Áudio, Podcasts e Mapas",
                "narration": "Transforme leitura em áudio com discussões entre dois apresentadores, além de mapas conceituais e flashcards de memorização.",
                "visual_cue": "🧠 Multiformatos para Aprendizado Acelerado",
                "bullet": "Podcasts, Slides, Vídeos, Mapas e Flashcards.",
                "duration_sec": 8,
                "bg_gradient": "gradient-3"
            },
            {
                "scene_number": 4,
                "heading": "⚡ Conclusão & Ação",
                "narration": "O Gemini Notebook OS substitui ferramentas dispersas por um fluxo produtivo, rápido e integrado. Explore agora mesmo!",
                "visual_cue": "✨ Transforme sua Produtividade com IA",
                "bullet": "Seu segundo cérebro impulsionado pelo Google Gemini.",
                "duration_sec": 7,
                "bg_gradient": "gradient-4"
            }
        ]
    }

