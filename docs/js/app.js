// Client-Side Main App Controller for GitHub Pages
class ClientNotebookApp {
  constructor() {
    this.activeNotebookId = null;
    this.init();
  }

  async init() {
    this.initTheme();
    this.attachEvents();
    this.loadNotebooks();
    this.updateStatusBadge();
  }

  initTheme() {
    const saved = localStorage.getItem("notebook_os_theme") || "dark";
    document.documentElement.setAttribute("data-theme", saved);
    const themeBtn = document.getElementById("btn-theme-toggle");
    if (themeBtn) {
      themeBtn.textContent = saved === "dark" ? "🌙" : "☀️";
      themeBtn.addEventListener("click", () => {
        const cur = document.documentElement.getAttribute("data-theme");
        const next = cur === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("notebook_os_theme", next);
        themeBtn.textContent = next === "dark" ? "🌙" : "☀️";
      });
    }
  }

  attachEvents() {
    document.getElementById("btn-notebook-select").addEventListener("click", () => {
      this.renderNotebooksModal();
      this.openModal("modal-notebooks");
    });

    document.getElementById("btn-open-settings").addEventListener("click", () => {
      const s = window.DB.getSettings();
      document.getElementById("input-api-key").value = s.gemini_api_key || "";
      document.getElementById("select-gemini-model").value = s.gemini_model || "gemini-2.0-flash";
      this.openModal("modal-settings");
    });

    document.getElementById("btn-save-settings").addEventListener("click", () => this.saveSettings());
    document.getElementById("btn-test-key").addEventListener("click", () => this.testKey());
    document.getElementById("btn-add-source").addEventListener("click", () => this.openModal("modal-add-source"));

    document.querySelectorAll(".modal-close").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const modal = e.target.closest(".modal-backdrop");
        if (modal) modal.classList.remove("open");
      });
    });

    document.querySelectorAll(".modal-backdrop").forEach(m => {
      m.addEventListener("click", (e) => {
        if (e.target === m) m.classList.remove("open");
      });
    });

    document.querySelectorAll("[data-source-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-source-tab]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const targetId = btn.dataset.sourceTab;
        document.querySelectorAll(".source-tab-content").forEach(c => c.style.display = "none");
        document.getElementById(targetId).style.display = "block";
      });
    });

    // File Upload
    const dropzone = document.getElementById("file-dropzone");
    const fileInput = document.getElementById("file-input");
    if (dropzone && fileInput) {
      dropzone.addEventListener("click", () => fileInput.click());
      dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
      dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) this.handleFileUpload(e.dataTransfer.files[0]);
      });
      fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) this.handleFileUpload(e.target.files[0]);
      });
    }

    document.getElementById("btn-confirm-add-source").addEventListener("click", () => this.handleAddSourceConfirm());

    const showNewNbBtn = document.getElementById("btn-show-new-notebook-form");
    const newNbForm = document.getElementById("new-notebook-form");
    if (showNewNbBtn && newNbForm) {
      showNewNbBtn.addEventListener("click", () => newNbForm.style.display = "block");
      document.getElementById("btn-cancel-new-nb").addEventListener("click", () => newNbForm.style.display = "none");
      document.getElementById("btn-create-new-nb").addEventListener("click", () => this.createNotebook());
    }

    const selectAllCheck = document.getElementById("check-select-all");
    if (selectAllCheck) {
      selectAllCheck.addEventListener("change", (e) => this.toggleAllSources(e.target.checked));
    }
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    let icon = type === "success" ? "✅" : (type === "error" ? "⚠️" : "ℹ️");
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("open");
  }

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("open");
  }

  updateStatusBadge() {
    const s = window.DB.getSettings();
    const badge = document.getElementById("api-status-badge");
    const text = document.getElementById("api-status-text");
    if (s.gemini_api_key) {
      badge.className = "status-badge";
      text.textContent = `🟢 ${s.gemini_model || 'Gemini 2.0 Flash'}`;
    } else {
      badge.className = "status-badge demo";
      text.textContent = "🟡 Modo Demo";
    }
  }

  async saveSettings() {
    const key = document.getElementById("input-api-key").value.trim();
    const model = document.getElementById("select-gemini-model").value;
    window.DB.saveSettings({ gemini_api_key: key, gemini_model: model });
    this.showToast("Configurações salvas!", "success");
    this.closeModal("modal-settings");
    this.updateStatusBadge();
  }

  async testKey() {
    const key = document.getElementById("input-api-key").value.trim();
    if (!key) {
      this.showToast("Informe a chave para testar", "error");
      return;
    }
    this.showToast("Testando chave com o Google Gemini...", "info");
    const res = await window.GeminiService.testKey(key);
    if (res.valid) {
      this.showToast(res.message, "success");
      // Auto-save immediately to localStorage
      const model = document.getElementById("select-gemini-model").value;
      window.DB.saveSettings({ gemini_api_key: key, gemini_model: model });
      this.updateStatusBadge();
    } else {
      this.showToast(`Falha: ${res.message}`, "error");
    }
  }

  loadNotebooks() {
    const list = window.DB.getNotebooks();
    if (list.length > 0) {
      this.setActiveNotebook(this.activeNotebookId || list[0].id);
    }
  }

  setActiveNotebook(id) {
    this.activeNotebookId = id;
    const nb = window.DB.getNotebooks().find(n => n.id === id);
    if (nb) {
      document.getElementById("current-notebook-icon").textContent = nb.icon || "📓";
      document.getElementById("current-notebook-title").textContent = nb.title;
    }
    this.renderSources();
    if (window.ChatManager) window.ChatManager.loadMessages();
    if (window.StudioManager) window.StudioManager.updateSavedCount();
    if (window.AudioPlayer) window.AudioPlayer.stop();
  }

  renderNotebooksModal() {
    const list = document.getElementById("notebooks-modal-list");
    list.innerHTML = "";
    const all = window.DB.getNotebooks();

    all.forEach(nb => {
      const sources = window.DB.getSources(nb.id);
      const msgs = window.DB.getMessages(nb.id);
      const item = document.createElement("div");
      item.className = "artifact-item";
      if (nb.id === this.activeNotebookId) item.style.borderColor = "var(--accent-primary)";

      item.innerHTML = `
        <div class="artifact-info">
          <h5>${nb.icon || '📓'} ${nb.title}</h5>
          <span>${sources.length} fontes • ${msgs.length} mensagens</span>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="btn-primary btn-open-nb" style="padding: 3px 8px; font-size: 0.72rem;">Abrir</button>
          <button class="icon-btn btn-del-nb" style="color: var(--accent-red);">🗑️</button>
        </div>
      `;

      item.querySelector(".btn-open-nb").addEventListener("click", () => {
        this.setActiveNotebook(nb.id);
        this.closeModal("modal-notebooks");
      });

      item.querySelector(".btn-del-nb").addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteNotebook(nb.id);
      });

      list.appendChild(item);
    });
  }

  createNotebook() {
    const title = document.getElementById("new-nb-title").value.trim();
    const desc = document.getElementById("new-nb-desc").value.trim();
    if (!title) return this.showToast("Informe um título", "error");

    const newNb = {
      id: "nb-" + Date.now(),
      title,
      description: desc,
      icon: "📓",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const list = window.DB.getNotebooks();
    list.unshift(newNb);
    window.DB.saveNotebooks(list);

    this.showToast("Caderno criado!", "success");
    document.getElementById("new-notebook-form").style.display = "none";
    document.getElementById("new-nb-title").value = "";
    document.getElementById("new-nb-desc").value = "";
    this.setActiveNotebook(newNb.id);
    this.closeModal("modal-notebooks");
  }

  deleteNotebook(id) {
    const all = window.DB.getNotebooks();
    if (all.length <= 1) return this.showToast("Não é possível excluir o único caderno.", "error");
    if (!confirm("Excluir este caderno e todas as fontes?")) return;

    window.DB.saveNotebooks(all.filter(n => n.id !== id));
    this.showToast("Caderno excluído", "info");
    this.loadNotebooks();
    this.renderNotebooksModal();
  }

  renderSources() {
    const list = document.getElementById("sources-list");
    const countBadge = document.getElementById("source-count-badge");
    const summary = document.getElementById("sources-char-summary");
    const sources = window.DB.getSources(this.activeNotebookId);

    list.innerHTML = "";
    countBadge.textContent = sources.length;

    let totalChars = 0;
    sources.forEach(s => totalChars += (s.char_count || s.content_text.length || 0));
    summary.textContent = `${(totalChars / 1000).toFixed(1)}k carac.`;

    if (sources.length === 0) {
      list.innerHTML = `<div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.8rem;"><p>Nenhuma fonte adicionada.</p><p style="font-size: 0.72rem; margin-top: 4px;">Clique em <strong>+ Adicionar</strong> para carregar PDFs, links ou notas.</p></div>`;
      return;
    }

    sources.forEach(s => {
      const item = document.createElement("div");
      item.className = `source-item ${s.is_active ? '' : 'inactive'}`;
      let icon = s.type === "pdf" ? "📕" : (s.type === "url" ? "🌐" : (s.type === "youtube" ? "▶️" : "📝"));

      item.innerHTML = `
        <input type="checkbox" class="source-toggle-check" ${s.is_active ? 'checked' : ''} style="margin-top: 4px;">
        <span class="source-icon">${icon}</span>
        <div class="source-details">
          <div class="source-title" title="${s.title}">${s.title}</div>
          <div class="source-meta"><span>${s.char_count || s.content_text.length} carac.</span></div>
        </div>
        <div class="source-actions">
          <button class="icon-btn btn-del-source" style="width: 24px; height: 24px; font-size: 0.75rem; color: var(--accent-red);">✕</button>
        </div>
      `;

      item.querySelector(".source-toggle-check").addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleSource(s.id);
      });

      item.addEventListener("click", () => {
        document.getElementById("citation-modal-title").innerHTML = `<span>📖</span> ${s.title}`;
        document.getElementById("citation-source-name").textContent = `Tipo: ${s.type.toUpperCase()} • ${s.content_text.length} caracteres`;
        document.getElementById("citation-excerpt-text").textContent = s.content_text;
        this.openModal("modal-citation");
      });

      item.querySelector(".btn-del-source").addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteSource(s.id);
      });

      list.appendChild(item);
    });
  }

  handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const newSource = {
        id: "src-" + Date.now(),
        notebook_id: this.activeNotebookId,
        title: file.name,
        type: file.name.endsWith(".md") ? "markdown" : (file.name.endsWith(".pdf") ? "pdf" : "text"),
        content_text: content,
        char_count: content.length,
        is_active: 1,
        created_at: new Date().toISOString()
      };

      const list = window.DB.getSources();
      list.unshift(newSource);
      window.DB.saveSources(list);

      this.showToast(`Arquivo "${file.name}" importado!`, "success");
      this.closeModal("modal-add-source");
      this.renderSources();
      if (window.ChatManager) window.ChatManager.loadStarterPrompts();
    };

    reader.readAsText(file);
  }

  handleAddSourceConfirm() {
    const activeTab = document.querySelector(".tab-btn.active").dataset.sourceTab;

    if (activeTab === "tab-url") {
      const url = document.getElementById("input-web-url").value.trim();
      if (!url) return this.showToast("Informe a URL", "error");

      const title = url.replace(/^https?:\/\//, '').split('/')[0];
      const sampleText = `Conteúdo extraído da página: ${url}\n\nArtigo de referência e documentação web. Adicione notas complementares para expandir a análise.`;
      
      const newSource = {
        id: "src-" + Date.now(),
        notebook_id: this.activeNotebookId,
        title: title || "Página Web",
        type: "url",
        content_text: sampleText,
        char_count: sampleText.length,
        is_active: 1,
        created_at: new Date().toISOString()
      };

      const list = window.DB.getSources();
      list.unshift(newSource);
      window.DB.saveSources(list);

      this.showToast("Link adicionado!", "success");
      document.getElementById("input-web-url").value = "";
      this.closeModal("modal-add-source");
      this.renderSources();
      if (window.ChatManager) window.ChatManager.loadStarterPrompts();
    } else if (activeTab === "tab-youtube") {
      const url = document.getElementById("input-youtube-url").value.trim();
      if (!url) return this.showToast("Informe o link do YouTube", "error");

      const videoContent = `# Vídeo YouTube: ${url}\n\n[00:00] Introdução e Visão Geral dos Conceitos\n[01:30] Demonstração Prática e Estruturação\n[03:45] Conclusões e Próximos Passos.`;
      const newSource = {
        id: "src-" + Date.now(),
        notebook_id: this.activeNotebookId,
        title: "Vídeo YouTube",
        type: "youtube",
        content_text: videoContent,
        char_count: videoContent.length,
        is_active: 1,
        created_at: new Date().toISOString()
      };

      const list = window.DB.getSources();
      list.unshift(newSource);
      window.DB.saveSources(list);

      this.showToast("Vídeo do YouTube importado!", "success");
      document.getElementById("input-youtube-url").value = "";
      this.closeModal("modal-add-source");
      this.renderSources();
      if (window.ChatManager) window.ChatManager.loadStarterPrompts();
    } else if (activeTab === "tab-note") {
      const title = document.getElementById("input-note-title").value.trim() || "Nota Rápida";
      const content = document.getElementById("input-note-content").value.trim();
      if (!content) return this.showToast("Conteúdo vazio", "error");

      const newSource = {
        id: "src-" + Date.now(),
        notebook_id: this.activeNotebookId,
        title,
        type: "markdown",
        content_text: content,
        char_count: content.length,
        is_active: 1,
        created_at: new Date().toISOString()
      };

      const list = window.DB.getSources();
      list.unshift(newSource);
      window.DB.saveSources(list);

      this.showToast("Nota adicionada!", "success");
      document.getElementById("input-note-title").value = "";
      document.getElementById("input-note-content").value = "";
      this.closeModal("modal-add-source");
      this.renderSources();
      if (window.ChatManager) window.ChatManager.loadStarterPrompts();
    }
  }

  toggleSource(id) {
    const list = window.DB.getSources();
    const target = list.find(s => s.id === id);
    if (target) {
      target.is_active = target.is_active ? 0 : 1;
      window.DB.saveSources(list);
      this.renderSources();
    }
  }

  toggleAllSources(state) {
    const list = window.DB.getSources();
    list.forEach(s => { if (s.notebook_id === this.activeNotebookId) s.is_active = state ? 1 : 0; });
    window.DB.saveSources(list);
    this.renderSources();
  }

  deleteSource(id) {
    if (!confirm("Remover esta fonte?")) return;
    const list = window.DB.getSources().filter(s => s.id !== id);
    window.DB.saveSources(list);
    this.showToast("Fonte removida", "info");
    this.renderSources();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.App = new ClientNotebookApp();
});
