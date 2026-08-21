import os
import json
import requests
import re
from app.database import get_setting
from app.config import DEFAULT_MODEL

PERSONA_PROMPTS = {
    "default": "Você é o assistente inteligente do Gemini Notebook OS. Seja claro, conciso, profissional e use formatação Markdown elegante.",
    "researcher": "Você é um Pesquisador Acadêmico e Cientista de Dados sênior. Forneça análises aprofundadas, rigor metodológico, sintetize pontos fortes e fracos e cite meticulosamente as fontes.",
    "teacher": "Você é um Professor Didático e Mentor no estilo Feynman. Explique conceitos complexos com extrema clareza, usando metáforas do dia a dia, listas didáticas e passos fáceis de memorizar.",
    "seo_creator": "Você é um Estrategista de Conteúdo Digital e Especialista em SEO e Viralidade. Extraia ganchos poderosos (hooks), ideias de posts, títulos chamativos e estratégias práticas de distribuição.",
    "analyst": "Você é um Analista Estratégico de Negócios. Foque em insights acionáveis, riscos, oportunidades, métricas e recomendações diretas."
}

def get_active_gemini_key() -> str:
    """Returns Gemini API key from database setting or environment variable."""
    db_key = get_setting("gemini_api_key", "").strip()
    if db_key:
        return db_key
    return os.environ.get("GEMINI_API_KEY", "").strip()

def get_active_model() -> str:
    """Returns active model identifier."""
    return get_setting("gemini_model", DEFAULT_MODEL)

def test_gemini_key(api_key: str) -> dict:
    """Tests if a given Gemini API key is valid by querying the models list and sending a test ping."""
    clean_key = api_key.strip()
    list_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={clean_key}"
    
    try:
        res = requests.get(list_url, timeout=12)
        if res.status_code == 200:
            data = res.json()
            models_list = data.get("models", [])
            gen_models = [
                m["name"].replace("models/", "")
                for m in models_list
                if "generateContent" in m.get("supportedGenerationMethods", [])
            ]
            
            top_model = gen_models[0] if gen_models else "gemini-2.0-flash"
            return {
                "valid": True,
                "message": f"Chave de API do Gemini válida e conectada! ({len(gen_models)} modelos disponíveis)",
                "available_models": gen_models
            }
        else:
            err_data = res.json().get("error", {})
            return {"valid": False, "message": err_data.get("message", f"Erro HTTP {res.status_code}")}
    except Exception as e:
        return {"valid": False, "message": f"Erro de conexão: {str(e)}"}

def generate_grounded_response(
    notebook_id: str,
    user_query: str,
    context_text: str,
    citations_map: dict,
    persona: str = "default",
    history: list = None
) -> dict:
    """Calls Gemini API with grounding context and strict citation instructions, with fallback if key is absent."""
    api_key = get_active_gemini_key()
    active_model = get_active_model().replace("models/", "")
    persona_system = PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS["default"])

    grounding_system_instruction = f"""{persona_system}

INSTRUÇÕES OBRIGATÓRIAS DE GROUNDING (ANCORAGEM EM FONTES):
1. Sua principal fonte de verdade são estritamente os trechos de documentos fornecidos na seção [CONTEXTO DE FONTES].
2. SEMPRE que mencionar um fato, dado, citação ou conceito derivado dos trechos, insira a citação correspondente no formato [1], [2], etc., combinando com os números das citações fornecidas.
3. Se a informação não estiver presente no contexto, indique educadamente o que foi encontrado nos documentos e o que não foi mencionado.
4. Responda em Português do Brasil com excelente formatação Markdown (títulos, negrito, tópicos e tabelas quando apropriado).
"""

    prompt = f"""[CONTEXTO DE FONTES]:
{context_text}

---
Pergunta do Usuário: {user_query}
"""

    # If Gemini API Key is configured, execute live LLM call with candidate fallback
    if api_key:
        candidate_models = [active_model, "gemini-2.0-flash", "gemini-1.5-flash-8b", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-pro"]
        # deduplicate while preserving order
        unique_candidates = []
        for m in candidate_models:
            if m not in unique_candidates:
                unique_candidates.append(m)

        for model in unique_candidates:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                
                contents = []
                if history:
                    for h in history[-6:]:
                        contents.append({
                            "role": "user" if h["role"] == "user" else "model",
                            "parts": [{"text": h["content"]}]
                        })
                
                contents.append({
                    "role": "user",
                    "parts": [{"text": prompt}]
                })

                payload = {
                    "systemInstruction": {"parts": [{"text": grounding_system_instruction}]},
                    "contents": contents,
                    "generationConfig": {
                        "temperature": 0.4,
                        "maxOutputTokens": 2048,
                    }
                }

                res = requests.post(url, json=payload, timeout=30)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        reply_text = candidates[0]["content"]["parts"][0]["text"]
                        
                        # Extract citations used in text
                        used_citations = []
                        for cite_num, info in citations_map.items():
                            if f"[{cite_num}]" in reply_text:
                                used_citations.append({"number": cite_num, **info})

                        return {
                            "content": reply_text,
                            "citations": used_citations,
                            "is_demo": False,
                            "model": model
                        }
                elif res.status_code in [404, 400]:
                    # Try next candidate model
                    continue
            except Exception as e:
                print(f"[Gemini API Request Exception on {model}] {e}")

    # Fallback / Intelligent Demo Mode generator
    return generate_demo_grounded_response(user_query, context_text, citations_map, persona)

def generate_demo_grounded_response(query: str, context: str, citations_map: dict, persona: str) -> dict:
    """Generates an intelligent contextual response with accurate citations in demo mode."""
    if not citations_map:
        return {
            "content": "⚠️ **Nenhuma fonte ativa selecionada ou encontrada.**\n\nPor favor, adicione um documento (PDF, Link da Web, Vídeo do YouTube ou Nota) no painel esquerdo para que eu possa analisar e responder com base no seu material.",
            "citations": [],
            "is_demo": True
        }

    # Extract bullet points from context chunks
    bullets = []
    used_cites = []
    for num, info in list(citations_map.items())[:4]:
        excerpt_clean = info["excerpt"].replace("\n", " ").strip()
        sentences = [s.strip() for s in excerpt_clean.split(".") if len(s.strip()) > 20]
        if sentences:
            chosen_sentence = sentences[0]
            bullets.append(f"- **{info['source_title']}**: {chosen_sentence}. [{num}]")
            used_cites.append({"number": num, **info})

    persona_prefix = ""
    if persona == "researcher":
        persona_prefix = "🔬 **Análise de Pesquisa:** Com base na síntese dos documentos selecionados, verificamos os seguintes pontos estruturais:\n\n"
    elif persona == "teacher":
        persona_prefix = "👨‍🏫 **Explicação Didática:** Vamos decompor o tema a partir dos materiais que você reuniu:\n\n"
    elif persona == "seo_creator":
        persona_prefix = "🚀 **Visão de Criação & Destaques:** Aqui estão os principais insights estratégicos extraídos das suas fontes:\n\n"
    elif persona == "analyst":
        persona_prefix = "📊 **Resumo Analítico:** Identificamos as seguintes conclusões-chave com base nas fontes fornecidas:\n\n"
    else:
        persona_prefix = "Com base nas fontes ativas carregadas no seu caderno, encontrei as seguintes informações relevantes para a sua pergunta:\n\n"

    body = "\n".join(bullets)
    conclusion = f"\n\n> 💡 *Dica:* Para respostas geradas pelo modelo Gemini 2.0 Flash / 1.5 Pro em tempo real, você pode adicionar sua chave gratuita do **Google AI Studio** a qualquer momento clicando no ícone de ⚙️ **Configurações**."

    return {
        "content": persona_prefix + body + conclusion,
        "citations": used_cites,
        "is_demo": True,
        "model": "Modo Demonstração (Sem API Key)"
    }
