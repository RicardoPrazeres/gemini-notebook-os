// Main App Controller & State Manager for Gemini Notebook OS
class GeminiNotebookApp {
  constructor() {
    this.activeNotebookId = null;
    this.notebooks = [];
    this.sources = [];
    this.settings = { has_api_key: false, active_model: "gemini-2.0-flash" };

    this.init();
  }

  async init() {
    this.initTheme();
    this.attachGlobalEvents();
    await this.loadSettings();
    await this.loadNotebooks();
  }

  // Theme Management
  initTheme() {
    const savedTheme = localStorage.getItem("notebook_os_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    const themeBtn = document.getElementById("btn-theme-toggle");
    if (themeBtn) {
      themeBtn.textContent = savedTheme === "dark" ? "🌙" : "☀️";
      themeBtn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme");
        const next = current === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("notebook_os_theme", next);
        themeBtn.textContent = next === "dark" ? "🌙" : "☀️";
      });
    }
  }

  // Attach DOM Events
  attachGlobalEvents() {
    // Notebook Dropdown
    document.getElementById("btn-notebook-select").addEventListener("click", () => {
      this.renderNotebooksModal();
      this.openModal("modal-notebooks");
    });

    // Settings Button
    document.getElementById("btn-open-settings").addEventListener("click", () => {
      this.openSettingsModal();
    });

    // Save Settings
    document.getElementById("btn-save-settings").addEventListener("click", () => this.saveSettings());
    document.getElementById("btn-test-key").addEventListener("click", () => this.testApiKey());

    // Add Source Button
    document.getElementById("btn-add-source").addEventListener("click", () => {
      this.openModal("modal-add-source");
    });

    // Modal Close buttons
    document.querySelectorAll(".modal-close").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const modal = e.target.closest(".modal-backdrop");
        if (modal) modal.classList.remove("open");
      });
    });

    // Close on backdrop click
    document.querySelectorAll(".modal-backdrop").forEach(modal => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("open");
      });
    });

    // Source Modal Tabs
    document.querySelectorAll("[data-source-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-source-tab]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const targetId = btn.dataset.sourceTab;
        document.querySelectorAll(".source-tab-content").forEach(c => c.style.display = "none");
        document.getElementById(targetId).style.display = "block";
      });
    });

    // File Dropzone
    const dropzone = document.getElementById("file-dropzone");
    const fileInput = document.getElementById("file-input");

    if (dropzone && fileInput) {
      dropzone.addEventListener("click", () => fileInput.click());
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });
      dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) {
          this.uploadFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
          this.uploadFile(e.target.files[0]);
        }
      });
    }

    // Confirm Add Source (for URL, YouTube, Note)
    document.getElementById("btn-confirm-add-source").addEventListener("click", () => this.handleAddSourceConfirm());

    // Inline New Notebook toggle
    const showNewNbBtn = document.getElementById("btn-show-new-notebook-form");
    const newNbForm = document.getElementById("new-notebook-form");
    if (showNewNbBtn && newNbForm) {
      showNewNbBtn.addEventListener("click", () => newNbForm.style.display = "block");
      document.getElementById("btn-cancel-new-nb").addEventListener("click", () => newNbForm.style.display = "none");
      document.getElementById("btn-create-new-nb").addEventListener("click", () => this.createNotebook());
    }

    // Select all sources toggle
    const selectAllCheck = document.getElementById("check-select-all");
    if (selectAllCheck) {
      selectAllCheck.addEventListener("change", (e) => this.toggleAllSources(e.target.checked));
    }
  }

  // Toast Notifications
  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "error") icon = "⚠️";

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("open");
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("open");
  }

  // Settings
  async loadSettings() {
    try {
      const res = await fetch("/api/settings");
      this.settings = await res.json();
      this.updateStatusBadge();
    } catch (e) {
      console.error("Erro ao carregar settings:", e);
    }
  }

  updateStatusBadge() {
    const badge = document.getElementById("api-status-badge");
    const text = document.getElementById("api-status-text");

    if (this.settings.has_api_key) {
      badge.className = "status-badge";
      text.textContent = `🟢 ${this.settings.active_model}`;
    } else {
      badge.className = "status-badge demo";
      text.textContent = "🟡 Modo Demo";
    }
  }

  openSettingsModal() {
    const select = document.getElementById("select-gemini-model");
    if (select && this.settings.available_models) {
      select.innerHTML = "";
      this.settings.available_models.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = `${m.name} (${m.badge})`;
        if (m.id === this.settings.active_model) opt.selected = true;
        select.appendChild(opt);
      });
    }
    this.openModal("modal-settings");
  }

  async saveSettings() {
    const key = document.getElementById("input-api-key").value.trim();
    const model = document.getElementById("select-gemini-model").value;

    const payload = { gemini_model: model };
    if (key) payload.gemini_api_key = key;

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        this.showToast("Configurações salvas com sucesso!", "success");
        this.closeModal("modal-settings");
        await this.loadSettings();
      }
    } catch (e) {
      this.showToast("Erro ao salvar configurações", "error");
    }
  }

  async testApiKey() {
    const key = document.getElementById("input-api-key").value.trim();
    if (!key) {
      this.showToast("Insira a chave para testar", "error");
      return;
    }

    this.showToast("Testando chave com o Google Gemini...", "info");
    try {
      const res = await fetch("/api/settings/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key })
      });
      const data = await res.json();
      if (data.valid) {
        this.showToast(data.message, "success");
      } else {
        this.showToast(`Falha: ${data.message}`, "error");
      }
    } catch (e) {
      this.showToast("Erro ao testar conexão", "error");
    }
  }

  // Notebooks Management
  async loadNotebooks() {
    try {
      const res = await fetch("/api/notebooks");
      this.notebooks = await res.json();

      if (this.notebooks.length > 0) {
        // Select first notebook or preserve active
        const target = this.notebooks.find(n => n.id === this.activeNotebookId) || this.notebooks[0];
        this.setActiveNotebook(target.id);
      }
    } catch (e) {
      console.error("Erro ao carregar cadernos:", e);
    }
  }

  setActiveNotebook(notebookId) {
    this.activeNotebookId = notebookId;
    const nb = this.notebooks.find(n => n.id === notebookId);
    if (nb) {
      document.getElementById("current-notebook-icon").textContent = nb.icon || "📓";
      document.getElementById("current-notebook-title").textContent = nb.title;
    }

    this.loadSources();
    if (window.ChatManager) window.ChatManager.loadMessages();
    if (window.StudioManager) window.StudioManager.updateSavedCount();
    if (window.AudioPlayer) window.AudioPlayer.stop();
  }

  renderNotebooksModal() {
    const list = document.getElementById("notebooks-modal-list");
    list.innerHTML = "";

    this.notebooks.forEach(nb => {
      const item = document.createElement("div");
      item.className = "artifact-item";
      if (nb.id === this.activeNotebookId) {
        item.style.borderColor = "var(--accent-primary)";
      }

      item.innerHTML = `
        <div class="artifact-info">
          <h5>${nb.icon || '📓'} ${nb.title}</h5>
          <span>${nb.source_count || 0} fontes • ${nb.message_count || 0} mensagens</span>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="btn-primary btn-select-nb" style="padding: 3px 8px; font-size: 0.72rem;">Abrir</button>
          <button class="icon-btn btn-del-nb" title="Excluir" style="color: var(--accent-red);">🗑️</button>
        </div>
      `;

      item.querySelector(".btn-select-nb").addEventListener("click", () => {
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

  async createNotebook() {
    const title = document.getElementById("new-nb-title").value.trim();
    const desc = document.getElementById("new-nb-desc").value.trim();
    if (!title) {
      this.showToast("Informe um título para o caderno", "error");
      return;
    }

    try {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: desc })
      });
      const data = await res.json();
      if (res.ok) {
        this.showToast("Caderno criado com sucesso!", "success");
        document.getElementById("new-notebook-form").style.display = "none";
        document.getElementById("new-nb-title").value = "";
        document.getElementById("new-nb-desc").value = "";
        await this.loadNotebooks();
        this.setActiveNotebook(data.id);
        this.closeModal("modal-notebooks");
      }
    } catch (e) {
      this.showToast("Erro ao criar caderno", "error");
    }
  }

  async deleteNotebook(id) {
    if (this.notebooks.length <= 1) {
      this.showToast("Não é possível excluir o único caderno existente.", "error");
      return;
    }
    if (!confirm("Tem certeza que deseja excluir este caderno e todas as suas fontes?")) return;

    try {
      await fetch(`/api/notebooks/${id}`, { method: "DELETE" });
      this.showToast("Caderno excluído", "info");
      await this.loadNotebooks();
      this.renderNotebooksModal();
    } catch (e) {
      this.showToast("Erro ao excluir caderno", "error");
    }
  }

  // Sources Management
  async loadSources() {
    if (!this.activeNotebookId) return;

    try {
      const res = await fetch(`/api/notebooks/${this.activeNotebookId}/sources`);
      this.sources = await res.json();
      this.renderSources();
    } catch (e) {
      console.error("Erro ao carregar fontes:", e);
    }
  }

  renderSources() {
    const list = document.getElementById("sources-list");
    const countBadge = document.getElementById("source-count-badge");
    const summary = document.getElementById("sources-char-summary");

    list.innerHTML = "";
    countBadge.textContent = this.sources.length;

    let totalChars = 0;
    this.sources.forEach(s => totalChars += (s.char_count || 0));
    summary.textContent = `${(totalChars / 1000).toFixed(1)}k carac.`;

    if (this.sources.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.8rem;">
          <p>Nenhuma fonte adicionada.</p>
          <p style="font-size: 0.72rem; margin-top: 4px;">Clique em <strong>+ Adicionar</strong> para carregar PDFs, links ou vídeos.</p>
        </div>
      `;
      return;
    }

    this.sources.forEach(s => {
      const item = document.createElement("div");
      item.className = `source-item ${s.is_active ? '' : 'inactive'}`;

      let icon = "📄";
      if (s.type === "pdf") icon = "📕";
      if (s.type === "url") icon = "🌐";
      if (s.type === "youtube") icon = "▶️";
      if (s.type === "markdown") icon = "📝";

      item.innerHTML = `
        <input type="checkbox" class="source-toggle-check" ${s.is_active ? 'checked' : ''} style="margin-top: 4px;">
        <span class="source-icon">${icon}</span>
        <div class="source-details">
          <div class="source-title" title="${s.title}">${s.title}</div>
          <div class="source-meta">
            <span>${(s.char_count || 0)} carac.</span>
          </div>
        </div>
        <div class="source-actions">
          <button class="icon-btn btn-del-source" title="Excluir" style="width: 24px; height: 24px; font-size: 0.75rem; color: var(--accent-red);">✕</button>
        </div>
      `;

      // Toggle active status
      item.querySelector(".source-toggle-check").addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleSource(s.id);
      });

      // View details
      item.addEventListener("click", () => this.viewSourceDetails(s.id));

      // Delete
      item.querySelector(".btn-del-source").addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteSource(s.id);
      });

      list.appendChild(item);
    });
  }

  async uploadFile(file) {
    if (!this.activeNotebookId) return;

    const statusEl = document.getElementById("upload-status");
    statusEl.style.display = "block";
    statusEl.textContent = `Carregando e processando ${file.name}...`;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/notebooks/${this.activeNotebookId}/sources/upload`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        this.showToast(`Arquivo "${file.name}" importado com sucesso!`, "success");
        this.closeModal("modal-add-source");
        statusEl.style.display = "none";
        await this.loadSources();
        if (window.ChatManager) window.ChatManager.loadStarterPrompts();
      } else {
        statusEl.textContent = `Erro: ${data.detail || 'Falha ao processar arquivo'}`;
      }
    } catch (e) {
      statusEl.textContent = "Erro na requisição de upload.";
    }
  }

  async handleAddSourceConfirm() {
    if (!this.activeNotebookId) return;

    // Check active tab
    const activeTab = document.querySelector(".tab-btn.active").dataset.sourceTab;

    if (activeTab === "tab-url") {
      const url = document.getElementById("input-web-url").value.trim();
      if (!url) {
        this.showToast("Informe a URL da página", "error");
        return;
      }
      this.showToast("Lendo página e extraindo conteúdo...", "info");
      try {
        const res = await fetch(`/api/notebooks/${this.activeNotebookId}/sources/url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notebook_id: this.activeNotebookId, url })
        });
        if (res.ok) {
          this.showToast("Página adicionada às fontes!", "success");
          document.getElementById("input-web-url").value = "";
          this.closeModal("modal-add-source");
          await this.loadSources();
        } else {
          const err = await res.json();
          this.showToast(err.detail || "Erro ao adicionar URL", "error");
        }
      } catch (e) {
        this.showToast("Falha ao buscar URL", "error");
      }
    } else if (activeTab === "tab-youtube") {
      const url = document.getElementById("input-youtube-url").value.trim();
      if (!url) {
        this.showToast("Informe o link do YouTube", "error");
        return;
      }
      this.showToast("Extraindo vídeo e transcrição...", "info");
      try {
        const res = await fetch(`/api/notebooks/${this.activeNotebookId}/sources/youtube`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notebook_id: this.activeNotebookId, url })
        });
        if (res.ok) {
          this.showToast("Vídeo do YouTube importado com sucesso!", "success");
          document.getElementById("input-youtube-url").value = "";
          this.closeModal("modal-add-source");
          await this.loadSources();
        } else {
          const err = await res.json();
          this.showToast(err.detail || "Erro ao processar YouTube", "error");
        }
      } catch (e) {
        this.showToast("Falha na requisição", "error");
      }
    } else if (activeTab === "tab-note") {
      const title = document.getElementById("input-note-title").value.trim();
      const content = document.getElementById("input-note-content").value.trim();
      if (!content) {
        this.showToast("O conteúdo da nota não pode estar vazio", "error");
        return;
      }
      try {
        const res = await fetch(`/api/notebooks/${this.activeNotebookId}/sources/note`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notebook_id: this.activeNotebookId, title, content })
        });
        if (res.ok) {
          this.showToast("Nota adicionada!", "success");
          document.getElementById("input-note-title").value = "";
          document.getElementById("input-note-content").value = "";
          this.closeModal("modal-add-source");
          await this.loadSources();
        }
      } catch (e) {
        this.showToast("Erro ao criar nota", "error");
      }
    }
  }

  async toggleSource(id) {
    try {
      await fetch(`/api/sources/${id}/toggle`, { method: "PATCH" });
      await this.loadSources();
    } catch (e) {}
  }

  async toggleAllSources(state) {
    for (const s of this.sources) {
      if (Boolean(s.is_active) !== state) {
        await this.toggleSource(s.id);
      }
    }
  }

  async viewSourceDetails(id) {
    try {
      const res = await fetch(`/api/sources/${id}`);
      const s = await res.json();

      document.getElementById("citation-modal-title").innerHTML = `<span>📖</span> ${s.title}`;
      document.getElementById("citation-source-name").textContent = `Tipo: ${s.type.toUpperCase()} • ${s.char_count} caracteres • ${s.chunks ? s.chunks.length : 0} chunks indexados`;
      document.getElementById("citation-excerpt-text").textContent = s.content_text;
      this.openModal("modal-citation");
    } catch (e) {
      this.showToast("Erro ao carregar detalhes da fonte", "error");
    }
  }

  async deleteSource(id) {
    if (!confirm("Deseja remover esta fonte do caderno?")) return;
    try {
      await fetch(`/api/sources/${id}`, { method: "DELETE" });
      this.showToast("Fonte removida", "info");
      await this.loadSources();
      if (window.ChatManager) window.ChatManager.loadStarterPrompts();
    } catch (e) {
      this.showToast("Erro ao excluir fonte", "error");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.App = new GeminiNotebookApp();
});
