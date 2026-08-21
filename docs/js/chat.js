// Client-Side Chat Manager for GitHub Pages
class ClientChatManager {
  constructor() {
    this.currentPersona = "default";
    this.historyContainer = document.getElementById("chat-history");
    this.emptyState = document.getElementById("empty-chat-state");
    this.starterChips = document.getElementById("starter-chips");
    this.chatInput = document.getElementById("chat-input");
    this.sendBtn = document.getElementById("btn-send-message");
    this.clearBtn = document.getElementById("btn-clear-chat");
    this.init();
  }

  init() {
    document.querySelectorAll(".persona-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        document.querySelectorAll(".persona-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        this.currentPersona = pill.dataset.persona;
        window.App.showToast(`Persona ativada: ${pill.textContent}`, "info");
      });
    });

    if (this.chatInput) {
      this.chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
      this.chatInput.addEventListener("input", () => {
        this.chatInput.style.height = "auto";
        this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + "px";
      });
    }

    if (this.sendBtn) this.sendBtn.addEventListener("click", () => this.sendMessage());
    if (this.clearBtn) this.clearBtn.addEventListener("click", () => this.clearChat());
  }

  loadMessages() {
    const nbId = window.App.activeNotebookId;
    if (!nbId) return;
    this.render();
    this.loadStarterPrompts();
  }

  loadStarterPrompts() {
    const nbId = window.App.activeNotebookId;
    if (!nbId || !this.starterChips) return;
    const sources = window.DB.getSources(nbId).filter(s => s.is_active);
    
    let prompts = [
      "Quais são os principais conceitos deste caderno?",
      "Faça um resumo executivo dos pontos fundamentais.",
      "Crie um guia de estudo rápido para iniciantes.",
      "Quais são as perguntas mais importantes a serem respondidas?"
    ];

    if (sources.length > 0) {
      const firstTitle = sources[0].title.split(".")[0];
      prompts = [
        `Faça um resumo com foco em '${firstTitle}'`,
        "Quais são os principais pontos práticos e conclusões?",
        "Compare as diferentes ideias apresentadas nos documentos.",
        "Crie 3 tópicos para discussão baseados neste material."
      ];
    }

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
  }

  async sendMessage() {
    const query = this.chatInput.value.trim();
    const nbId = window.App.activeNotebookId;
    if (!query || !nbId) return;

    const userMsg = {
      id: "msg-" + Date.now(),
      notebook_id: nbId,
      role: "user",
      content: query,
      citations: [],
      created_at: new Date().toISOString()
    };

    const messages = window.DB.getMessages(nbId);
    messages.push(userMsg);
    window.DB.saveMessages([...window.DB.getMessages().filter(m => m.notebook_id !== nbId), ...messages]);
    this.render();

    this.chatInput.value = "";
    this.chatInput.style.height = "auto";
    this.sendBtn.disabled = true;

    // RAG Context
    const { contextText, citationsMap } = window.RAGEngine.buildGroundingContext(nbId, query);

    // Call Gemini Client
    const response = await window.GeminiService.generateResponse(
      query,
      contextText,
      citationsMap,
      this.currentPersona,
      messages
    );

    const assistantMsg = {
      id: "msg-" + (Date.now() + 1),
      notebook_id: nbId,
      role: "assistant",
      content: response.content,
      citations: response.citations || [],
      is_demo: response.is_demo,
      model: response.model,
      created_at: new Date().toISOString()
    };

    messages.push(assistantMsg);
    window.DB.saveMessages([...window.DB.getMessages().filter(m => m.notebook_id !== nbId), ...messages]);

    this.sendBtn.disabled = false;
    this.render();
    this.scrollToBottom();
  }

  clearChat() {
    const nbId = window.App.activeNotebookId;
    if (!nbId) return;
    if (!confirm("Deseja limpar o histórico de conversas deste caderno?")) return;

    const all = window.DB.getMessages().filter(m => m.notebook_id !== nbId);
    window.DB.saveMessages(all);
    this.render();
    this.loadStarterPrompts();
    window.App.showToast("Histórico limpo", "info");
  }

  render() {
    const nbId = window.App.activeNotebookId;
    const messages = window.DB.getMessages(nbId);

    if (messages.length === 0) {
      this.emptyState.style.display = "flex";
      this.historyContainer.innerHTML = "";
      this.historyContainer.appendChild(this.emptyState);
      return;
    }

    this.emptyState.style.display = "none";
    this.historyContainer.innerHTML = "";

    messages.forEach(msg => {
      const row = document.createElement("div");
      row.className = `message-row ${msg.role}`;

      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      avatar.textContent = msg.role === "user" ? "👤" : "✨";

      const bubble = document.createElement("div");
      bubble.className = "message-bubble";
      bubble.innerHTML = this.parseMarkdown(msg.content);

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

      if (msg.role === "assistant") {
        const actions = document.createElement("div");
        actions.className = "message-actions";
        const copyBtn = document.createElement("button");
        copyBtn.className = "msg-action-btn";
        copyBtn.innerHTML = "📋 Copiar";
        copyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(msg.content);
          window.App.showToast("Copiado!", "info");
        });
        actions.appendChild(copyBtn);
        bubble.appendChild(actions);
      }

      row.appendChild(avatar);
      row.appendChild(bubble);
      this.historyContainer.appendChild(row);
    });

    this.historyContainer.querySelectorAll(".cite-pill").forEach(pill => {
      pill.addEventListener("click", (e) => {
        e.preventDefault();
        const num = parseInt(pill.dataset.cite);
        const lastMsg = messages.find(m => m.citations && m.citations.some(c => (c.number || 1) === num));
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

  parseMarkdown(text) {
    if (!text) return "";
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(/```([\s\S]*?)```/g, (match, p1) => `<pre><code>${p1.trim()}</code></pre>`);
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>");
    html = html.replace(/^\s*-\s+(.*$)/gim, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>)/gim, "<ul>$1</ul>");
    html = html.replace(/<\/ul>\s*<ul>/g, "");
    html = html.replace(/\[(?:cite:)?(\d+)\]/g, '<button class="cite-pill" data-cite="$1">[$1]</button>');

    const paragraphs = html.split(/\n\n+/);
    return paragraphs.map(p => {
      if (p.startsWith("<h") || p.startsWith("<pre") || p.startsWith("<ul") || p.startsWith("<blockquote")) return p;
      return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    }).join("");
  }
}

window.ChatManager = new ClientChatManager();
