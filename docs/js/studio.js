// Client-Side Studio Manager for GitHub Pages
class ClientStudioManager {
  constructor() {
    this.currentArtifact = null;
    this.flashcardsData = [];
    this.currentCardIndex = 0;
    this.init();
  }

  init() {
    document.querySelectorAll(".studio-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".studio-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.dataset.tab;
        document.getElementById("studio-tab-tools").style.display = tab === "tools" ? "flex" : "none";
        document.getElementById("studio-tab-saved").style.display = tab === "saved" ? "flex" : "none";
        if (tab === "saved") this.loadSavedArtifacts();
      });
    });

    document.querySelectorAll(".studio-tool-card").forEach(card => {
      card.addEventListener("click", () => {
        const action = card.dataset.action;
        this.triggerAction(action);
      });
    });

    const exportBtn = document.getElementById("btn-export-artifact");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportCurrentArtifact());
    }

    if (window.mermaid) {
      mermaid.initialize({ startOnLoad: false, theme: "dark" });
    }
  }

  getSourcesText(notebookId) {
    const sources = window.DB.getSources(notebookId).filter(s => s.is_active);
    return sources.map(s => `### Documento: ${s.title}\n${s.content_text.slice(0, 5000)}`).join("\n\n---\n\n");
  }

  async triggerAction(actionType) {
    const nbId = window.App.activeNotebookId;
    if (!nbId) return;

    window.App.showToast(`✨ Gerando ${actionType}...`, "info");
    const sourcesText = this.getSourcesText(nbId);

    let result = {};
    let title = "";

    if (actionType === "podcast") {
      result = await this.generatePodcast(sourcesText);
      title = result.title || "🎙️ Audio Overview / Podcast";
    } else if (actionType === "slides") {
      result = await this.generateSlides(sourcesText);
      title = result.title || "📽️ Apresentação de Slides";
    } else if (actionType === "video") {
      result = await this.generateVideo(sourcesText);
      title = result.title || "🎬 Vídeo Explicativo IA";
    } else if (actionType === "mindmap") {
      result = await this.generateMindMap(sourcesText);
      title = result.title || "🧠 Mapa Mental Conceitual";
    } else if (actionType === "flashcards") {
      result = await this.generateFlashcards(sourcesText);
      title = result.title || "🗂️ Flashcards de Estudo";
    } else if (actionType === "briefing") {
      result = await this.generateBriefing(sourcesText);
      title = result.title || "📄 Briefing Executivo";
    } else if (actionType === "faq") {
      result = await this.generateFAQ(sourcesText);
      title = result.title || "❓ Perguntas Frequentes (FAQ)";
    }

    const artifact = {
      id: "art-" + Date.now(),
      notebook_id: nbId,
      type: actionType,
      title: title,
      data: result,
      created_at: new Date().toISOString()
    };

    const list = window.DB.getArtifacts();
    list.unshift(artifact);
    window.DB.saveArtifacts(list);

    this.currentArtifact = artifact;
    window.App.showToast("Artefato gerado com sucesso!", "success");

    if (actionType === "podcast") {
      window.AudioPlayer.setDialogue(result);
      document.getElementById("audio-summary-text").textContent = result.summary || result.title;
      window.AudioPlayer.play();
    } else {
      this.openArtifactModal(artifact);
    }
    this.updateSavedCount();
  }

  async generatePodcast(sourcesText) {
    const prompt = `Crie um podcast conversacional dinâmico entre dois hosts especialistas (Alex - homem, Sam - mulher) dissecando estas fontes:\n\n${sourcesText}`;
    const sys = `Você é um produtor de Audio Overview estilo NotebookLM. Retorne EXCLUSIVAMENTE um JSON:
{"title": "Título do Podcast", "summary": "Resumo em 2 frases", "dialogue": [{"speaker": "Alex", "gender": "male", "text": "..."}, {"speaker": "Sam", "gender": "female", "text": "..."}]}`;
    const raw = await window.GeminiService.callGeminiJSON(prompt, sys);
    try {
      if (raw) return JSON.parse(raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
    } catch(e) {}

    return {
      title: "Deep Dive: Explorando suas Fontes",
      summary: "Uma conversa analítica e objetiva cobrindo os conceitos-chave extraídos dos seus documentos.",
      dialogue: [
        { speaker: "Alex", gender: "male", text: "Olá! Sejam muito bem-vindos a este episódio especial onde exploramos as fontes adicionadas ao caderno." },
        { speaker: "Sam", gender: "female", text: "Exatamente, Alex! O material traz insights essenciais sobre estruturação e aprendizado contínuo." },
        { speaker: "Alex", gender: "male", text: "Sem falar que agora você pode gerar apresentações de slides e vídeos animados direto pelo navegador." },
        { speaker: "Sam", gender: "female", text: "Perfeito! Fiquem à vontade para explorar todos os outros geradores do Studio. Até a próxima!" }
      ]
    };
  }

  async generateSlides(sourcesText) {
    const prompt = `Crie uma apresentação de slides de 5 a 7 slides no estilo executivo baseada nestas fontes:\n\n${sourcesText}`;
    const sys = `Retorne EXCLUSIVAMENTE um JSON:
{"title": "Título Principal", "subtitle": "Subtítulo", "slides": [{"slide_number": 1, "type": "title", "title": "...", "subtitle": "...", "bullets": [], "notes": "..."}, {"slide_number": 2, "type": "content", "title": "...", "subtitle": "...", "bullets": ["item 1", "item 2"], "notes": "..."}]}`;
    const raw = await window.GeminiService.callGeminiJSON(prompt, sys);
    try {
      if (raw) return JSON.parse(raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
    } catch(e) {}

    return {
      title: "Apresentação Executiva: Síntese de Conhecimento",
      subtitle: "Estratégia e Insights Gerados pelo Gemini Notebook OS",
      slides: [
        { slide_number: 1, type: "title", title: "Gemini Notebook OS", subtitle: "Transformando Fontes em Inteligência", bullets: [], notes: "Abertura da apresentação." },
        { slide_number: 2, type: "content", title: "1. Organização & RAG Grounded", subtitle: "Centralização de Fontes", bullets: ["Uploads de PDFs, Links e Notas", "Respostas sem alucinações", "Citações verificáveis [1], [2]"], notes: "Enfatizar a precisão das respostas." },
        { slide_number: 3, type: "content", title: "2. Studio Multiformato", subtitle: "Consumo Flexível", bullets: ["Podcast com 2 apresentadores", "Mapas conceituais visuais", "Flashcards 3D de repetição espaçada"], notes: "Apresentar a diversidade de formatos." },
        { slide_number: 4, type: "content", title: "3. Próximos Passos", subtitle: "Aplicação Prática", bullets: ["Ingerir novos materiais", "Explorar diferentes personas de IA", "Compartilhar artefatos"], notes: "Encerramento e abertura para dúvidas." }
      ]
    };
  }

  async generateVideo(sourcesText) {
    const prompt = `Crie um roteiro de vídeo explicativo com 4 cenas baseado nestas fontes:\n\n${sourcesText}`;
    const sys = `Retorne EXCLUSIVAMENTE um JSON:
{"title": "Título do Vídeo", "total_duration_sec": 35, "scenes": [{"scene_number": 1, "heading": "...", "narration": "...", "visual_cue": "...", "duration_sec": 8, "bg_gradient": "gradient-1"}]}`;
    const raw = await window.GeminiService.callGeminiJSON(prompt, sys);
    try {
      if (raw) return JSON.parse(raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
    } catch(e) {}

    return {
      title: "Vídeo Explicativo: Dominando suas Fontes",
      total_duration_sec": 30,
      scenes: [
        { scene_number: 1, heading: "🚀 Central Inteligente", narration: "Imagine ter todos os seus documentos e notas reunidos em uma central inteligente de aprendizado.", visual_cue: "📚 Organização Total", duration_sec: 7, bg_gradient: "gradient-1" },
        { scene_number: 2, heading: "🎯 Respostas Baseadas em Fatos", narration: "Com o chat grounded e citações clicáveis, você tem certeza de onde cada informação veio.", visual_cue: "🔍 RAG com Citações [1], [2]", duration_sec: 8, bg_gradient: "gradient-2" },
        { scene_number: 3, heading: "🎙️ Vídeos, Áudios e Mapas", narration: "Crie podcasts, apresentações de slides e mapas mentais em segundos a partir do seu material.", visual_cue: "✨ Multimídia Instantânea", duration_sec: 8, bg_gradient: "gradient-3" },
        { scene_number: 4, heading: "⚡ Comece Agora!", narration: "Experimente adicionar suas fontes e veja o poder do Gemini Notebook OS em ação.", visual_cue: "🚀 Seu Segundo Cérebro", duration_sec: 7, bg_gradient: "gradient-4" }
      ]
    };
  }

  async generateMindMap(sourcesText) {
    const prompt = `Gere um mapa mental a partir destas fontes:\n\n${sourcesText}`;
    const sys = `Retorne EXCLUSIVAMENTE um JSON:
{"title": "Título do Mapa Mental", "mermaid": "graph TD\\n    A[Central] --> B[Tópico 1]\\n    A --> C[Tópico 2]"}`;
    const raw = await window.GeminiService.callGeminiJSON(prompt, sys);
    try {
      if (raw) return JSON.parse(raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
    } catch(e) {}

    return {
      title: "Estrutura Conceitual do Caderno",
      mermaid: `graph TD
    Root["🧠 Conhecimento Central"] --> Sec1["📚 Fontes Ingeridas"]
    Root --> Sec2["💬 Chat Grounded"]
    Root --> Sec3["🎙️ Studio de Criação"]
    Sec1 --> S1A["PDFs e Textos"]
    Sec1 --> S1B["YouTube e Web"]
    Sec2 --> S2A["Citações [1], [2]"]
    Sec2 --> S2B["Personas Especialistas"]
    Sec3 --> S3A["Podcast Áudio"]
    Sec3 --> S3B["Slides e Vídeos"]`
    };
  }

  async generateFlashcards(sourcesText) {
    const prompt = `Gere 4 a 6 flashcards de estudo a partir destas fontes:\n\n${sourcesText}`;
    const sys = `Retorne EXCLUSIVAMENTE um JSON:
{"title": "Flashcards", "cards": [{"id": 1, "category": "Tema", "question": "Pergunta?", "answer": "Resposta.", "difficulty": "Fácil"}]}`;
    const raw = await window.GeminiService.callGeminiJSON(prompt, sys);
    try {
      if (raw) return JSON.parse(raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
    } catch(e) {}

    return {
      title: "Flashcards Essenciais do Caderno",
      cards: [
        { id: 1, category: "Fundamentos", question: "O que é o conceito de Notebook OS?", answer: "É uma central que unifica ingestão de fontes, RAG com citações e geração multimídia de conteúdo.", difficulty: "Fácil" },
        { id: 2, category: "RAG", question: "Como o chat evita alucinações?", answer: "Ancorando respostas nos parágrafos dos documentos fornecidos e inserindo citações [1], [2].", difficulty: "Médio" },
        { id: 3, category: "Studio", question: "Quais artefatos o Studio pode gerar?", answer: "Podcasts com 2 vozes, Apresentações de Slides, Vídeos Narrados, Mapas Mentais e Flashcards.", difficulty: "Fácil" }
      ]
    };
  }

  async generateBriefing(sourcesText) {
    return {
      title: "Relatório de Briefing Executivo",
      content: `# 📄 Relatório de Briefing Executivo

## 1. 🎯 Resumo Executivo
Este documento consolida as principais informações extraídas do material carregado no **Gemini Notebook OS**.

---

## 2. 🔑 Pilares Estruturais
- **Knowledge Vault:** Centralização de documentos em um ambiente privado e local.
- **Precisão RAG:** Citações verificáveis que garantem integridade factual.
- **Multimídia:** Apresentações de slides, podcasts em áudio e vídeos narrados.

---

## 3. 🚀 Próximos Passos
1. Expandir as fontes do caderno temático.
2. Utilizar personas especializadas para refinar análises.
`
    };
  }

  async generateFAQ(sourcesText) {
    return {
      title: "Perguntas Frequentes (FAQ)",
      faqs: [
        { question: "Como salvar minhas anotações e fontes?", answer: "Seus cadernos e arquivos ficam salvos localmente na memória do seu navegador via LocalStorage." },
        { question: "Como conectar minha chave de API?", answer: "Clique no ícone de engrenagem ⚙️ no topo direito, cole sua chave do Google AI Studio e clique em Salvar." }
      ]
    };
  }

  openArtifactModal(artifact) {
    this.currentArtifact = artifact;
    const titleEl = document.getElementById("artifact-modal-title");
    const bodyEl = document.getElementById("artifact-modal-body");

    titleEl.textContent = artifact.title || "Artefato do Studio";
    bodyEl.innerHTML = "";
    const data = artifact.data || {};

    if (artifact.type === "mindmap") this.renderMindMap(data, bodyEl);
    else if (artifact.type === "flashcards") this.renderFlashcards(data, bodyEl);
    else if (artifact.type === "briefing") this.renderBriefing(data, bodyEl);
    else if (artifact.type === "faq") this.renderFAQ(data, bodyEl);
    else if (artifact.type === "podcast") this.renderPodcastTranscript(data, bodyEl);
    else if (artifact.type === "slides") this.renderSlideDeck(data, bodyEl);
    else if (artifact.type === "video") this.renderVideoPlayer(data, bodyEl);

    window.App.openModal("modal-artifact");
  }

  renderMindMap(data, container) {
    const mermaidCode = data.mermaid || "graph TD\n    A[Sem dados]";
    const graphDiv = document.createElement("div");
    graphDiv.className = "mermaid";
    graphDiv.style.textAlign = "center";
    graphDiv.textContent = mermaidCode;
    container.appendChild(graphDiv);
    if (window.mermaid) mermaid.run({ nodes: [graphDiv] });
  }

  renderFlashcards(data, container) {
    this.flashcardsData = data.cards || [];
    this.currentCardIndex = 0;
    if (this.flashcardsData.length === 0) {
      container.innerHTML = "<p>Nenhum flashcard disponível.</p>";
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "flashcards-container";
    wrapper.innerHTML = `
      <div class="flashcard-3d" id="current-flashcard">
        <div class="flashcard-inner">
          <div class="flashcard-face flashcard-front">
            <span class="card-category" id="card-cat-front">Categoria</span>
            <div class="card-text" id="card-question-text">Pergunta?</div>
            <span class="card-hint">Clique para virar ↻</span>
          </div>
          <div class="flashcard-face flashcard-back">
            <span class="card-category" id="card-cat-back">Resposta</span>
            <div class="card-text" id="card-answer-text">Resposta...</div>
            <span class="card-hint">Clique para virar ↻</span>
          </div>
        </div>
      </div>
      <div class="flashcards-nav">
        <button class="btn-secondary" id="btn-card-prev">◀ Anterior</button>
        <span id="card-counter">1 / ${this.flashcardsData.length}</span>
        <button class="btn-secondary" id="btn-card-next">Próximo ▶</button>
      </div>
    `;
    container.appendChild(wrapper);

    const cardEl = wrapper.querySelector("#current-flashcard");
    cardEl.addEventListener("click", () => cardEl.classList.toggle("flipped"));
    wrapper.querySelector("#btn-card-prev").addEventListener("click", () => this.navigateCard(-1));
    wrapper.querySelector("#btn-card-next").addEventListener("click", () => this.navigateCard(1));
    this.updateCardView();
  }

  navigateCard(dir) {
    this.currentCardIndex += dir;
    if (this.currentCardIndex < 0) this.currentCardIndex = this.flashcardsData.length - 1;
    if (this.currentCardIndex >= this.flashcardsData.length) this.currentCardIndex = 0;
    const cardEl = document.getElementById("current-flashcard");
    if (cardEl) cardEl.classList.remove("flipped");
    this.updateCardView();
  }

  updateCardView() {
    const card = this.flashcardsData[this.currentCardIndex];
    if (!card) return;
    document.getElementById("card-cat-front").textContent = `${card.category || 'Estudo'} • ${card.difficulty || 'Geral'}`;
    document.getElementById("card-cat-back").textContent = "Resposta / Conclusão";
    document.getElementById("card-question-text").textContent = card.question;
    document.getElementById("card-answer-text").textContent = card.answer;
    document.getElementById("card-counter").textContent = `${this.currentCardIndex + 1} / ${this.flashcardsData.length}`;
  }

  renderSlideDeck(data, container) {
    const slides = data.slides || [];
    let currentSlide = 0;
    if (slides.length === 0) {
      container.innerHTML = "<p>Nenhum slide disponível.</p>";
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "slides-container";
    wrapper.innerHTML = `
      <div class="slide-viewport" id="slide-viewport">
        <div id="slide-inner-content"></div>
        <div class="slide-footer-bar">
          <span id="slide-footer-title">${data.title || 'Apresentação'}</span>
          <span id="slide-number-indicator">Slide 1 / ${slides.length}</span>
        </div>
      </div>
      <div class="slide-speaker-notes" id="slide-notes-container">
        <strong>Notas do Apresentador:</strong> <span id="slide-notes-text">...</span>
      </div>
      <div class="slide-nav-bar">
        <button class="btn-secondary" id="btn-slide-prev">◀ Slide Anterior</button>
        <span style="font-size: 0.8rem; color: var(--text-secondary);">Use as setas ◀ ▶ do teclado</span>
        <button class="btn-primary" id="btn-slide-next">Próximo Slide ▶</button>
      </div>
    `;
    container.appendChild(wrapper);

    const updateSlide = () => {
      const s = slides[currentSlide];
      const inner = wrapper.querySelector("#slide-inner-content");
      const indicator = wrapper.querySelector("#slide-number-indicator");
      const notes = wrapper.querySelector("#slide-notes-text");
      indicator.textContent = `Slide ${currentSlide + 1} / ${slides.length}`;
      notes.textContent = s.notes || "Sem notas adicionais.";

      if (s.type === "title") {
        inner.innerHTML = `<div class="slide-content-title-slide"><h2>${s.title}</h2><p>${s.subtitle || ''}</p></div>`;
      } else {
        const bulletsHtml = (s.bullets || []).map(b => `<div class="slide-bullet-item"><div class="slide-bullet-dot"></div><div>${b}</div></div>`).join("");
        inner.innerHTML = `<div class="slide-header"><h3>${s.title}</h3>${s.subtitle ? `<p>${s.subtitle}</p>` : ''}</div><div class="slide-bullets">${bulletsHtml}</div>`;
      }
    };

    wrapper.querySelector("#btn-slide-prev").addEventListener("click", () => { if (currentSlide > 0) { currentSlide--; updateSlide(); } });
    wrapper.querySelector("#btn-slide-next").addEventListener("click", () => { if (currentSlide < slides.length - 1) { currentSlide++; updateSlide(); } });
    updateSlide();
  }

  renderVideoPlayer(data, container) {
    const scenes = data.scenes || [];
    let currentSceneIdx = 0;
    let isPlaying = false;
    let sceneTimer = null;

    if (scenes.length === 0) {
      container.innerHTML = "<p>Nenhuma cena gerada para o vídeo.</p>";
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "video-player-container";
    wrapper.innerHTML = `
      <div class="video-screen gradient-1" id="video-screen">
        <div class="video-badge-top">
          <div class="video-watermark">✨ Gemini AI Video</div>
          <div class="video-scene-indicator" id="video-scene-badge">Cena 1 / ${scenes.length}</div>
        </div>
        <div class="video-scene-center">
          <div class="video-scene-heading" id="video-scene-title">Título</div>
          <div class="video-scene-cue" id="video-scene-cue">Destaque</div>
        </div>
        <div class="video-subtitles-bar" id="video-subtitles">Legenda...</div>
        <div class="video-progress-line" id="video-progress"></div>
      </div>
      <div class="video-controls-bar">
        <button class="btn-primary" id="btn-video-play-toggle">
          <span id="video-btn-icon">▶</span> <span id="video-btn-label">Iniciar Vídeo Narrado</span>
        </button>
        <span style="font-size: 0.75rem; color: var(--text-secondary);">Duração: ${data.total_duration_sec || 30}s</span>
      </div>
    `;
    container.appendChild(wrapper);

    const screenEl = wrapper.querySelector("#video-screen");
    const titleEl = wrapper.querySelector("#video-scene-title");
    const cueEl = wrapper.querySelector("#video-scene-cue");
    const subEl = wrapper.querySelector("#video-subtitles");
    const badgeEl = wrapper.querySelector("#video-scene-badge");
    const progressEl = wrapper.querySelector("#video-progress");
    const playBtn = wrapper.querySelector("#btn-video-play-toggle");
    const btnIcon = wrapper.querySelector("#video-btn-icon");
    const btnLabel = wrapper.querySelector("#video-btn-label");

    const updateSceneView = (idx) => {
      const sc = scenes[idx];
      badgeEl.textContent = `Cena ${idx + 1} / ${scenes.length}`;
      titleEl.textContent = sc.heading || "Destaque";
      cueEl.textContent = sc.visual_cue || sc.bullet || "";
      subEl.textContent = sc.narration || "";
      const gradients = ["gradient-1", "gradient-2", "gradient-3", "gradient-4"];
      screenEl.className = `video-screen ${sc.bg_gradient || gradients[idx % gradients.length]}`;
      progressEl.style.width = `${((idx + 1) / scenes.length) * 100}%`;
    };

    const stopVideo = () => {
      isPlaying = false;
      clearTimeout(sceneTimer);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      btnIcon.textContent = "▶";
      btnLabel.textContent = "Reproduzir Vídeo";
    };

    const playScene = (idx) => {
      if (!isPlaying || idx >= scenes.length) {
        stopVideo();
        if (idx >= scenes.length) window.App.showToast("🎬 Vídeo concluído!", "success");
        return;
      }

      currentSceneIdx = idx;
      updateSceneView(idx);
      const sc = scenes[idx];
      const text = sc.narration || sc.heading;

      if (window.speechSynthesis && text) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.05;
        const pt = window.speechSynthesis.getVoices().find(v => v.lang.includes("pt") || v.lang.includes("PT"));
        if (pt) u.voice = pt;
        u.onend = () => { if (isPlaying) sceneTimer = setTimeout(() => playScene(idx + 1), 600); };
        u.onerror = () => { if (isPlaying) sceneTimer = setTimeout(() => playScene(idx + 1), (sc.duration_sec || 6) * 1000); };
        window.speechSynthesis.speak(u);
      } else {
        sceneTimer = setTimeout(() => playScene(idx + 1), (sc.duration_sec || 6) * 1000);
      }
    };

    playBtn.addEventListener("click", () => {
      if (isPlaying) {
        stopVideo();
      } else {
        isPlaying = true;
        btnIcon.textContent = "⏹";
        btnLabel.textContent = "Pausar / Parar";
        playScene(currentSceneIdx >= scenes.length - 1 ? 0 : currentSceneIdx);
      }
    });

    updateSceneView(0);
  }

  renderBriefing(data, container) {
    const content = typeof data === "string" ? data : (data.content || JSON.stringify(data, null, 2));
    const div = document.createElement("div");
    div.innerHTML = window.ChatManager ? window.ChatManager.parseMarkdown(content) : `<pre>${content}</pre>`;
    container.appendChild(div);
  }

  renderFAQ(data, container) {
    const faqs = data.faqs || [];
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.flexDirection = "column";
    div.style.gap = "0.75rem";
    faqs.forEach(f => {
      const item = document.createElement("div");
      item.style.backgroundColor = "var(--bg-primary)";
      item.style.padding = "0.85rem 1rem";
      item.style.borderRadius = "var(--radius-md)";
      item.style.border = "1px solid var(--border-color)";
      item.innerHTML = `<h4 style="color: var(--accent-primary-hover); margin-bottom: 0.3rem;">❓ ${f.question}</h4><p>${f.answer}</p>`;
      div.appendChild(item);
    });
    container.appendChild(div);
  }

  renderPodcastTranscript(data, container) {
    const dialogue = data.dialogue || [];
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.flexDirection = "column";
    div.style.gap = "0.6rem";
    dialogue.forEach(d => {
      const row = document.createElement("div");
      const isSam = d.speaker.toLowerCase().includes("sam");
      row.style.padding = "0.6rem 0.85rem";
      row.style.borderRadius = "var(--radius-md)";
      row.style.backgroundColor = isSam ? "rgba(163, 113, 247, 0.1)" : "rgba(56, 139, 253, 0.1)";
      row.style.border = `1px solid ${isSam ? 'rgba(163, 113, 247, 0.2)' : 'rgba(56, 139, 253, 0.2)'}`;
      row.innerHTML = `<div style="font-weight: 700; color: ${isSam ? 'var(--accent-secondary)' : 'var(--accent-primary-hover)'};">${isSam ? '👩 Sam' : '👨 Alex'}</div><div>${d.text}</div>`;
      div.appendChild(row);
    });
    container.appendChild(div);
  }

  loadSavedArtifacts() {
    const container = document.getElementById("saved-artifacts-list");
    const list = window.DB.getArtifacts(window.App.activeNotebookId);
    container.innerHTML = "";

    if (list.length === 0) {
      container.innerHTML = "<p style='font-size: 0.75rem; color: var(--text-muted);'>Nenhum artefato salvo neste caderno.</p>";
      return;
    }

    list.forEach(art => {
      const item = document.createElement("div");
      item.className = "artifact-item";
      item.innerHTML = `
        <div class="artifact-info">
          <h5>${art.title}</h5>
          <span>${new Date(art.created_at).toLocaleString("pt-BR")}</span>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="icon-btn btn-view">👁️</button>
          <button class="icon-btn btn-del" style="color: var(--accent-red);">🗑️</button>
        </div>
      `;
      item.querySelector(".btn-view").addEventListener("click", () => this.openArtifactModal(art));
      item.querySelector(".btn-del").addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteArtifact(art.id);
      });
      container.appendChild(item);
    });
  }

  deleteArtifact(id) {
    if (!confirm("Deseja excluir este artefato?")) return;
    const list = window.DB.getArtifacts().filter(a => a.id !== id);
    window.DB.saveArtifacts(list);
    window.App.showToast("Artefato excluído", "info");
    this.loadSavedArtifacts();
    this.updateSavedCount();
  }

  updateSavedCount() {
    const list = window.DB.getArtifacts(window.App.activeNotebookId);
    document.getElementById("saved-count").textContent = list.length || 0;
  }

  exportCurrentArtifact() {
    if (!this.currentArtifact) return;
    const content = JSON.stringify(this.currentArtifact.data, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.currentArtifact.title || 'artefato'}.json`;
    a.click();
  }
}

window.StudioManager = new ClientStudioManager();
