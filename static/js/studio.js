// Studio Manager: Handles Artifact Generation & Visualizers
class StudioManager {
  constructor() {
    this.currentArtifact = null;
    this.currentCardIndex = 0;
    this.flashcardsData = [];

    this.init();
  }

  init() {
    // Studio tab switching
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

    // Studio tool cards click
    document.querySelectorAll(".studio-tool-card").forEach(card => {
      card.addEventListener("click", () => {
        const action = card.dataset.action;
        this.triggerAction(action);
      });
    });

    // Export button
    const exportBtn = document.getElementById("btn-export-artifact");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportCurrentArtifact());
    }

    // Initialize mermaid
    if (window.mermaid) {
      mermaid.initialize({ startOnLoad: false, theme: "dark" });
    }
  }

  async triggerAction(actionType) {
    if (!window.App.activeNotebookId) return;

    window.App.showToast(`✨ Gerando ${actionType}...`, "info");

    try {
      const res = await fetch(`/api/notebooks/${window.App.activeNotebookId}/studio/${actionType}`, {
        method: "POST"
      });
      const data = await res.json();
      
      if (res.ok) {
        this.currentArtifact = data;
        window.App.showToast("Artefato gerado com sucesso!", "success");

        if (actionType === "podcast") {
          window.AudioPlayer.setDialogue(data.data);
          document.getElementById("audio-summary-text").textContent = data.data.summary || data.data.title;
          window.AudioPlayer.play();
        } else {
          this.openArtifactModal(data);
        }
        this.updateSavedCount();
      } else {
        window.App.showToast(data.detail || "Erro ao gerar artefato", "error");
      }
    } catch (e) {
      window.App.showToast("Falha na requisição ao Studio", "error");
    }
  }

  openArtifactModal(artifact) {
    this.currentArtifact = artifact;
    const titleEl = document.getElementById("artifact-modal-title");
    const bodyEl = document.getElementById("artifact-modal-body");

    titleEl.textContent = artifact.title || "Artefato do Studio";
    bodyEl.innerHTML = "";

    const data = artifact.data || {};

    if (artifact.type === "mindmap") {
      this.renderMindMap(data, bodyEl);
    } else if (artifact.type === "flashcards") {
      this.renderFlashcards(data, bodyEl);
    } else if (artifact.type === "briefing") {
      this.renderBriefing(data, bodyEl);
    } else if (artifact.type === "faq") {
      this.renderFAQ(data, bodyEl);
    } else if (artifact.type === "podcast") {
      this.renderPodcastTranscript(data, bodyEl);
    } else if (artifact.type === "slides") {
      this.renderSlideDeck(data, bodyEl);
    } else if (artifact.type === "video") {
      this.renderVideoPlayer(data, bodyEl);
    }

    window.App.openModal("modal-artifact");
  }

  // Slide Deck Presentation Renderer
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
      notes.textContent = s.notes || "Sem anotações adicionais para este slide.";

      if (s.type === "title") {
        inner.innerHTML = `
          <div class="slide-content-title-slide">
            <h2>${s.title}</h2>
            <p>${s.subtitle || ''}</p>
          </div>
        `;
      } else {
        const bulletsHtml = (s.bullets || []).map(b => `
          <div class="slide-bullet-item">
            <div class="slide-bullet-dot"></div>
            <div>${b}</div>
          </div>
        `).join("");

        inner.innerHTML = `
          <div class="slide-header">
            <h3>${s.title}</h3>
            ${s.subtitle ? `<p>${s.subtitle}</p>` : ''}
          </div>
          <div class="slide-bullets">
            ${bulletsHtml}
          </div>
        `;
      }
    };

    wrapper.querySelector("#btn-slide-prev").addEventListener("click", () => {
      if (currentSlide > 0) {
        currentSlide--;
        updateSlide();
      }
    });

    wrapper.querySelector("#btn-slide-next").addEventListener("click", () => {
      if (currentSlide < slides.length - 1) {
        currentSlide++;
        updateSlide();
      }
    });

    // Keyboard navigation
    const keyHandler = (e) => {
      if (document.getElementById("modal-artifact").classList.contains("open")) {
        if (e.key === "ArrowRight" || e.key === "PageDown") {
          if (currentSlide < slides.length - 1) { currentSlide++; updateSlide(); }
        } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
          if (currentSlide > 0) { currentSlide--; updateSlide(); }
        }
      }
    };
    window.removeEventListener("keydown", keyHandler);
    window.addEventListener("keydown", keyHandler);

    updateSlide();
  }

  // AI Video Player & Storyboard Renderer
  renderVideoPlayer(data, container) {
    const scenes = data.scenes || [];
    let currentSceneIdx = 0;
    let isPlaying = false;
    let sceneTimer = null;
    let synthUtterance = null;

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
          <div class="video-scene-heading" id="video-scene-title">Título da Cena</div>
          <div class="video-scene-cue" id="video-scene-cue">Destaque Visual</div>
        </div>

        <div class="video-subtitles-bar" id="video-subtitles">
          Legenda da narração aparecerá aqui...
        </div>

        <div class="video-progress-line" id="video-progress"></div>
      </div>

      <div class="video-controls-bar">
        <button class="btn-primary" id="btn-video-play-toggle">
          <span id="video-btn-icon">▶</span> <span id="video-btn-label">Iniciar Vídeo Narrado</span>
        </button>
        <span style="font-size: 0.75rem; color: var(--text-secondary);" id="video-duration-info">
          Duração Estimada: ${data.total_duration_sec || 35}s
        </span>
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

      // Background gradient
      const gradients = ["gradient-1", "gradient-2", "gradient-3", "gradient-4"];
      screenEl.className = `video-screen ${sc.bg_gradient || gradients[idx % gradients.length]}`;

      // Progress bar
      const pct = ((idx + 1) / scenes.length) * 100;
      progressEl.style.width = `${pct}%`;
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
        if (idx >= scenes.length) {
          window.App.showToast("🎬 Vídeo finalizado com sucesso!", "success");
        }
        return;
      }

      currentSceneIdx = idx;
      updateSceneView(idx);

      const sc = scenes[idx];
      const narrationText = sc.narration || sc.heading;

      if (window.speechSynthesis && narrationText) {
        window.speechSynthesis.cancel();
        synthUtterance = new SpeechSynthesisUtterance(narrationText);
        synthUtterance.rate = 1.05;
        
        // Find pt-br voice if available
        const ptVoice = window.speechSynthesis.getVoices().find(v => v.lang.includes("pt") || v.lang.includes("PT"));
        if (ptVoice) synthUtterance.voice = ptVoice;

        synthUtterance.onend = () => {
          if (isPlaying) {
            sceneTimer = setTimeout(() => playScene(idx + 1), 600);
          }
        };
        synthUtterance.onerror = () => {
          if (isPlaying) {
            sceneTimer = setTimeout(() => playScene(idx + 1), (sc.duration_sec || 6) * 1000);
          }
        };

        window.speechSynthesis.speak(synthUtterance);
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

    // Initial render
    updateSceneView(0);
  }

  renderMindMap(data, container) {
    const mermaidCode = data.mermaid || "graph TD\n    A[Sem dados]";
    const graphDiv = document.createElement("div");
    graphDiv.className = "mermaid";
    graphDiv.style.textAlign = "center";
    graphDiv.style.overflow = "auto";
    graphDiv.textContent = mermaidCode;
    container.appendChild(graphDiv);

    if (window.mermaid) {
      mermaid.run({ nodes: [graphDiv] });
    }
  }

  renderFlashcards(data, container) {
    this.flashcardsData = data.cards || [];
    this.currentCardIndex = 0;

    if (this.flashcardsData.length === 0) {
      container.innerHTML = "<p>Nenhum flashcard gerado para estas fontes.</p>";
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
            <div class="card-text" id="card-answer-text" style="font-size: 0.95rem;">Resposta detalhada...</div>
            <span class="card-hint">Clique para virar ↻</span>
          </div>
        </div>
      </div>

      <div class="flashcards-nav">
        <button class="btn-secondary" id="btn-card-prev">◀ Anterior</button>
        <span id="card-counter" style="font-size: 0.8rem; font-weight: 600;">1 / ${this.flashcardsData.length}</span>
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

  navigateCard(direction) {
    this.currentCardIndex += direction;
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

  renderBriefing(data, container) {
    const content = typeof data === "string" ? data : (data.content || JSON.stringify(data, null, 2));
    const div = document.createElement("div");
    div.style.lineHeight = "1.6";
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

      item.innerHTML = `
        <h4 style="font-size: 0.9rem; color: var(--accent-primary-hover); margin-bottom: 0.3rem;">❓ ${f.question}</h4>
        <p style="font-size: 0.82rem; color: var(--text-primary);">${f.answer}</p>
      `;
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

      row.innerHTML = `
        <div style="font-weight: 700; font-size: 0.75rem; color: ${isSam ? 'var(--accent-secondary)' : 'var(--accent-primary-hover)'}; margin-bottom: 2px;">
          ${isSam ? '👩 Sam' : '👨 Alex'}
        </div>
        <div style="font-size: 0.85rem;">${d.text}</div>
      `;
      div.appendChild(row);
    });

    container.appendChild(div);
  }

  async loadSavedArtifacts() {
    if (!window.App.activeNotebookId) return;
    const container = document.getElementById("saved-artifacts-list");
    container.innerHTML = "<p style='font-size: 0.75rem; color: var(--text-muted);'>Carregando...</p>";

    try {
      const res = await fetch(`/api/notebooks/${window.App.activeNotebookId}/artifacts`);
      const list = await res.json();
      
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
            <button class="icon-btn btn-view" title="Visualizar">👁️</button>
            <button class="icon-btn btn-del" title="Excluir" style="color: var(--accent-red);">🗑️</button>
          </div>
        `;

        item.querySelector(".btn-view").addEventListener("click", () => this.openArtifactModal(art));
        item.querySelector(".btn-del").addEventListener("click", (e) => {
          e.stopPropagation();
          this.deleteArtifact(art.id);
        });

        container.appendChild(item);
      });
    } catch (e) {
      container.innerHTML = "<p style='font-size: 0.75rem; color: var(--accent-red);'>Erro ao carregar artefatos.</p>";
    }
  }

  async deleteArtifact(id) {
    if (!confirm("Deseja excluir este artefato?")) return;
    try {
      await fetch(`/api/artifacts/${id}`, { method: "DELETE" });
      window.App.showToast("Artefato excluído", "info");
      this.loadSavedArtifacts();
      this.updateSavedCount();
    } catch (e) {
      window.App.showToast("Erro ao excluir", "error");
    }
  }

  async updateSavedCount() {
    if (!window.App.activeNotebookId) return;
    try {
      const res = await fetch(`/api/notebooks/${window.App.activeNotebookId}/artifacts`);
      const list = await res.json();
      document.getElementById("saved-count").textContent = list.length || 0;
    } catch (e) {}
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

window.StudioManager = new StudioManager();
