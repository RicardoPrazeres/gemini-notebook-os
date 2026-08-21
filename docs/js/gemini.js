// Client-Side Google Gemini API Connector
class GeminiClientService {
  constructor() {
    this.personaPrompts = {
      default: "Você é o assistente inteligente do Gemini Notebook OS. Seja claro, conciso, profissional e use formatação Markdown elegante.",
      researcher: "Você é um Pesquisador Acadêmico e Cientista de Dados sênior. Forneça análises aprofundadas, rigor metodológico e cite meticulosamente as fontes.",
      teacher: "Você é um Professor Didático e Mentor no estilo Feynman. Explique conceitos complexos com extrema clareza e analogias simples.",
      seo_creator: "Você é um Estrategista de Conteúdo Digital e Especialista em Viralidade e SEO. Extraia ganchos poderosos e ideias acionáveis.",
      analyst: "Você é um Analista Estratégico de Negócios. Foque em insights práticos, oportunidades, riscos e tomada de decisão."
    };
  }

  async testKey(apiKey) {
    const cleanKey = apiKey.trim();
    if (!cleanKey) return { valid: false, message: "Chave vazia." };

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
      if (res.ok) {
        const data = await res.json();
        const genModels = (data.models || [])
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
          .map(m => m.name.replace("models/", ""));

        return {
          valid: true,
          message: `Chave de API do Gemini válida e conectada com sucesso! (${genModels.length} modelos disponíveis)`,
          models: genModels
        };
      } else {
        const err = await res.json();
        return { valid: false, message: err.error ? err.error.message : `Erro HTTP ${res.status}` };
      }
    } catch (e) {
      return { valid: false, message: `Erro de conexão: ${e.message}` };
    }
  }

  async generateResponse(userQuery, contextText, citationsMap, persona = "default", history = []) {
    const settings = window.DB.getSettings();
    const apiKey = (settings.gemini_api_key || "").trim();
    const activeModel = (settings.gemini_model || "gemini-2.0-flash").replace("models/", "");

    if (apiKey) {
      const candidateModels = [activeModel, "gemini-2.0-flash", "gemini-1.5-flash-8b", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-pro"];
      const personaSystem = this.personaPrompts[persona] || this.personaPrompts.default;

      const systemInstruction = `${personaSystem}

INSTRUÇÕES OBRIGATÓRIAS DE GROUNDING (ANCORAGEM EM FONTES):
1. Sua principal fonte de verdade são estritamente os trechos de documentos fornecidos no [CONTEXTO DE FONTES].
2. SEMPRE que mencionar um fato, dado ou conceito derivado dos trechos, insira a citação correspondente no formato [1], [2], etc.
3. Responda em Português com excelente formatação Markdown.`;

      const prompt = `[CONTEXTO DE FONTES]:\n${contextText}\n\n---\nPergunta do Usuário: ${userQuery}`;

      const contents = [];
      history.slice(-6).forEach(h => {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.content }]
        });
      });
      contents.push({ role: "user", parts: [{ text: prompt }] });

      for (const model of candidateModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents: contents,
              generationConfig: { temperature: 0.4, maxOutputTokens: 2048 }
            })
          });

          if (res.ok) {
            const data = await res.json();
            const replyText = data.candidates[0].content.parts[0].text;

            const usedCitations = [];
            Object.values(citationsMap).forEach(c => {
              if (replyText.includes(`[${c.number}]`)) {
                usedCitations.push(c);
              }
            });

            return {
              content: replyText,
              citations: usedCitations,
              is_demo: false,
              model: model
            };
          }
        } catch (e) {
          console.warn(`Tentativa com ${model} falhou:`, e);
        }
      }
    }

    // Demo Mode fallback
    return this.generateDemoResponse(userQuery, contextText, citationsMap, persona);
  }

  generateDemoResponse(query, contextText, citationsMap, persona) {
    const list = Object.values(citationsMap);
    if (list.length === 0) {
      return {
        content: "⚠️ **Nenhuma fonte ativa selecionada ou encontrada.**\n\nAdicione um documento (PDF, Link ou Nota) no painel esquerdo para que eu possa analisar e responder com base no seu material.",
        citations: [],
        is_demo: true,
        model: "Modo Demo"
      };
    }

    const bullets = list.slice(0, 3).map(c => {
      const firstSentence = c.excerpt.split(".")[0].replace(/\n/g, " ").trim();
      return `- **${c.source_title}**: ${firstSentence}. [${c.number}]`;
    });

    let prefix = "Com base nas fontes ativas carregadas no seu caderno, identifiquei os seguintes pontos:\n\n";
    if (persona === "teacher") prefix = "👨‍🏫 **Explicação Didática:** Vamos decompor o tema a partir dos seus materiais:\n\n";
    if (persona === "researcher") prefix = "🔬 **Análise de Pesquisa:** Com base na síntese dos documentos selecionados:\n\n";
    if (persona === "seo_creator") prefix = "🚀 **Destaques & Criação:** Aqui estão os principais insights extraídos:\n\n";
    if (persona === "analyst") prefix = "📊 **Resumo Estratégico:** Identificamos as seguintes conclusões-chave:\n\n";

    const body = bullets.join("\n");
    const tip = "\n\n> 💡 *Dica:* Para respostas em tempo real com o Gemini 2.0 Flash, adicione sua chave gratuita do **Google AI Studio** em ⚙️ **Configurações**.";

    return {
      content: prefix + body + tip,
      citations: list.slice(0, 3),
      is_demo: true,
      model: "Modo Demo"
    };
  }

  async callGeminiJSON(prompt, systemInstruction = "") {
    const settings = window.DB.getSettings();
    const apiKey = (settings.gemini_api_key || "").trim();
    const activeModel = (settings.gemini_model || "gemini-2.0-flash").replace("models/", "");

    if (apiKey) {
      const candidateModels = [activeModel, "gemini-2.0-flash", "gemini-1.5-flash-8b", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-pro"];
      for (const model of candidateModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.5, maxOutputTokens: 4096 }
            })
          });

          if (res.ok) {
            const data = await res.json();
            return data.candidates[0].content.parts[0].text;
          }
        } catch (e) {}
      }
    }
    return "";
  }
}

window.GeminiService = new GeminiClientService();
