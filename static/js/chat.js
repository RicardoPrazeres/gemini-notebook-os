// Chat Manager: Handles RAG Chat, Markdown Rendering & Grounded Citations
class ChatManager {
  constructor() {
    this.currentPersona = "default";
    this.messages = [];
    this.citationsMap = {};

    this.historyContainer = document.getElementById("chat-history");
    this.emptyState = document.getElementById("empty-chat-state");
    this.starterChips = document.getElementById("starter-chips");
    this.chatInput = document.getElementById("chat-input");
    this.sendBtn = document.getElementById("btn-send-message");
    this.clearBtn = document.getElementById("btn-clear-chat");

    this.init();
  }

  init() {
    // Persona selection
    document.querySelectorAll(".persona-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        document.querySelectorAll(".persona-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        this.currentPersona = pill.dataset.persona;
        window.App.showToast(`Persona ativada: ${pill.textContent}`, "info");
      });
    });

    // Send on Enter
    if (this.chatInput) {
      this.chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Auto-resize input
      this.chatInput.addEventListener("input", () => {
        this.chatInput.style.height = "auto";
        this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + "px";
      });
    }

    if (this.sendBtn) {
      this.sendBtn.addEventListener("click", () => this.sendMessage());
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener("click", () => this.clearChat());
    }
  }

  async loadMessages() {
    if (!window.App.activeNotebookId) return;

    try {
      const res = await fetch(`/api/notebooks/${window.App.activeNotebookId}/messages`);
      this.messages = await res.json();
      this.render();
      this.loadStarterPrompts();
    } catch (e) {
      console.error("Erro ao carregar mensagens:", e);
    }
  }

  async loadStarterPrompts() {
    if (!window.App.activeNotebookId || !this.starterChips) return;
    try {
      const res = await fetch(`/api/notebooks/${window.App.activeNotebookId}/starter-prompts`);
      const prompts = await res.json();
      this.starterChips.innerHTML = "";
      prompts.forEach(p => {
        const chip = document.createElement("div");
        chip.className = "starter-chip";
        chip.textContent = p;
        chip.addEventListener("click", () => {
          this.chatInput.value = p;
          this.sendMessage();
        });
        this.starterChips.appendChild(chip);
      });
    } catch (e) {}
  }

  async sendMessage() {
    const query = this.chatInput.value.trim();
    if (!query || !window.App.activeNotebookId) return;

    // Append user message immediately
    const userMsg = {
      id: "temp-" + Date.now(),
      role: "user",
      content: query,
      citations: []
    };
    this.messages.push(userMsg);
    this.render();

    this.chatInput.value = "";
    this.chatInput.style.height = "auto";
    this.sendBtn.disabled = true;

    // Temporary thinking bubble
    const thinkingMsg = {
      id: "thinking",
      role: "assistant",
      content: "🔍 Analisando documentos e gerando resposta...",
      citations: []
    };
    this.messages.push(thinkingMsg);
    this.render();

    try {
      const res = await fetch(`/api/notebooks/${window.App.activeNotebookId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          persona: this.currentPersona
        })
      });

      const data = await res.json();
      this.messages.pop(); // Remove thinking bubble

      if (res.ok) {
        this.messages.push(data);
      } else {
        this.messages.push({
          id: "err-" + Date.now(),
          role: "assistant",
          content: `⚠️ **Erro:** ${data.detail || 'Não foi possível gerar a resposta.'}`,
          citations: []
        });
      }
    } catch (e) {
      this.messages.pop();
      this.messages.push({
        id: "err-" + Date.now(),
        role: "assistant",
        content: "⚠️ **Falha na conexão com o servidor.** Verifique se o backend está ativo.",
        citations: []
      });
    } finally {
      this.sendBtn.disabled = false;
      this.render();
      this.scrollToBottom();
    }
  }

  async clearChat() {
    if (!window.App.activeNotebookId) return;
    if (!confirm("Deseja limpar todo o histórico de conversas deste caderno?")) return;

    try {
      await fetch(`/api/notebooks/${window.App.activeNotebookId}/messages`, { method: "DELETE" });
      this.messages = [];
      this.render();
      this.loadStarterPrompts();
      window.App.showToast("Histórico limpo com sucesso", "info");
    } catch (e) {
      window.App.showToast("Erro ao limpar histórico", "error");
    }
  }

  render() {
    if (this.messages.length === 0) {
      this.emptyState.style.display = "flex";
      this.historyContainer.innerHTML = "";
      this.historyContainer.appendChild(this.emptyState);
      return;
    }

    this.emptyState.style.display = "none";
    this.historyContainer.innerHTML = "";

    this.messages.forEach(msg => {
      const row = document.createElement("div");
      row.className = `message-row ${msg.role}`;

      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      avatar.textContent = msg.role === "user" ? "👤" : "✨";

      const bubble = document.createElement("div");
      bubble.className = "message-bubble";

      // Parse markdown & citations
      bubble.innerHTML = this.parseMarkdown(msg.content, msg.citations);

      // Attach citation chips at bottom if present
      if (msg.citations && msg.citations.length > 0) {
        const citesFooter = document.createElement("div");
        citesFooter.className = "citations-footer";

        msg.citations.forEach(c => {
          const chip = document.createElement("button");
          chip.className = "citation-chip";
          chip.innerHTML = `📌 [${c.number || 1}] ${c.source_title || 'Documento'}`;
          chip.addEventListener("click", () => this.showCitationModal(c));
          citesFooter.appendChild(chip);
        });

        bubble.appendChild(citesFooter);
      }

      // Actions (Copy & Read Aloud)
      if (msg.role === "assistant") {
        const actions = document.createElement("div");
        actions.className = "message-actions";

        const copyBtn = document.createElement("button");
        copyBtn.className = "msg-action-btn";
        copyBtn.innerHTML = "📋 Copiar";
        copyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(msg.content);
          window.App.showToast("Copiado para a área de transferência", "info");
        });
        actions.appendChild(copyBtn);

        bubble.appendChild(actions);
      }

      row.appendChild(avatar);
      row.appendChild(bubble);
      this.historyContainer.appendChild(row);
    });

    // Attach click events for in-text citation pills [1], [2]
    this.historyContainer.querySelectorAll(".cite-pill").forEach(pill => {
      pill.addEventListener("click", (e) => {
        e.preventDefault();
        const num = parseInt(pill.dataset.cite);
        // Find citation info from latest message
        const lastMsg = this.messages.find(m => m.citations && m.citations.some(c => (c.number || 1) === num));
        if (lastMsg) {
          const c = lastMsg.citations.find(item => (item.number || 1) === num);
          if (c) this.showCitationModal(c);
        }
      });
    });

    this.scrollToBottom();
  }

  showCitationModal(citation) {
    document.getElementById("citation-modal-title").innerHTML = `<span>📌</span> Citação [${citation.number || 1}]`;
    document.getElementById("citation-source-name").textContent = `Origem: ${citation.source_title || 'Documento'}`;
    document.getElementById("citation-excerpt-text").textContent = citation.excerpt || "Trecho não disponível.";
    window.App.openModal("modal-citation");
  }

  scrollToBottom() {
    this.historyContainer.scrollTop = this.historyContainer.scrollHeight;
  }

  parseMarkdown(text, citations = []) {
    if (!text) return "";

    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Code blocks ```lang ... ```
    html = html.replace(/```([\s\S]*?)```/g, (match, p1) => {
      return `<pre><code>${p1.trim()}</code></pre>`;
    });

    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Headers
    html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

    // Bold **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // Italic *text*
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // Blockquote > quote
    html = html.replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>");

    // Bullet lists
    html = html.replace(/^\s*-\s+(.*$)/gim, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>)/gim, "<ul>$1</ul>");
    html = html.replace(/<\/ul>\s*<ul>/g, "");

    // Citation pills [1], [2], [cite:1]
    html = html.replace(/\[(?:cite:)?(\d+)\]/g, '<button class="cite-pill" data-cite="$1">[$1]</button>');

    // Convert newlines to paragraphs
    const paragraphs = html.split(/\n\n+/);
    html = paragraphs.map(p => {
      if (p.startsWith("<h") || p.startsWith("<pre") || p.startsWith("<ul") || p.startsWith("<blockquote")) {
        return p;
      }
      return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    }).join("");

    return html;
  }
}

window.ChatManager = new ChatManager();
