// Browser Storage Engine for GitHub Pages (Offline-First / LocalStorage)
class LocalStore {
  constructor() {
    this.STORAGE_KEY_NOTEBOOKS = "gemini_nb_notebooks";
    this.STORAGE_KEY_SOURCES = "gemini_nb_sources";
    this.STORAGE_KEY_MESSAGES = "gemini_nb_messages";
    this.STORAGE_KEY_ARTIFACTS = "gemini_nb_artifacts";
    this.STORAGE_KEY_SETTINGS = "gemini_nb_settings";

    this.initStarterData();
  }

  getSettings() {
    const raw = localStorage.getItem(this.STORAGE_KEY_SETTINGS);
    return raw ? JSON.parse(raw) : { gemini_api_key: "", gemini_model: "gemini-2.0-flash" };
  }

  saveSettings(settings) {
    localStorage.setItem(this.STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }

  getNotebooks() {
    const raw = localStorage.getItem(this.STORAGE_KEY_NOTEBOOKS);
    return raw ? JSON.parse(raw) : [];
  }

  saveNotebooks(list) {
    localStorage.setItem(this.STORAGE_KEY_NOTEBOOKS, JSON.stringify(list));
  }

  getSources(notebookId) {
    const raw = localStorage.getItem(this.STORAGE_KEY_SOURCES);
    const all = raw ? JSON.parse(raw) : [];
    return notebookId ? all.filter(s => s.notebook_id === notebookId) : all;
  }

  saveSources(list) {
    localStorage.setItem(this.STORAGE_KEY_SOURCES, JSON.stringify(list));
  }

  getMessages(notebookId) {
    const raw = localStorage.getItem(this.STORAGE_KEY_MESSAGES);
    const all = raw ? JSON.parse(raw) : [];
    return notebookId ? all.filter(m => m.notebook_id === notebookId) : all;
  }

  saveMessages(list) {
    localStorage.setItem(this.STORAGE_KEY_MESSAGES, JSON.stringify(list));
  }

  getArtifacts(notebookId) {
    const raw = localStorage.getItem(this.STORAGE_KEY_ARTIFACTS);
    const all = raw ? JSON.parse(raw) : [];
    return notebookId ? all.filter(a => a.notebook_id === notebookId) : all;
  }

  saveArtifacts(list) {
    localStorage.setItem(this.STORAGE_KEY_ARTIFACTS, JSON.stringify(list));
  }

  initStarterData() {
    if (this.getNotebooks().length === 0) {
      const starterId = "starter-notebook-1";
      const now = new Date().toISOString();

      const starterNotebook = {
        id: starterId,
        title: "🚀 Guia de Boas-Vindas ao Gemini Notebook OS",
        description: "Caderno demonstrativo com exemplos de RAG, fontes e Studio multimídia.",
        icon: "💡",
        created_at: now,
        updated_at: now
      };

      const starterContent = `# Bem-vindo ao Gemini Notebook OS!

O **Gemini Notebook OS** é o seu centro de comando inteligente para pesquisa, estudos e criação com IA.

### Principais Capacidades:
1. **Knowledge Vault Multiformato:**
   - Adicione PDFs, arquivos Markdown (.md), textos e CSVs.
   - Cole links da Web ou vídeos do YouTube para analisar transcrições.
   - Crie notas rápidas em Markdown livre.

2. **Chat Grounded (Sem Alucinações):**
   - O chat utiliza RAG com citações estritas [1], [2].
   - Ao clicar nas citações, você inspeciona o trecho exato do documento original.
   - Escolha entre diferentes personas de IA (Pesquisador Crítico, Professor Didático, Estrategista SEO, Analista de Dados).

3. **Studio de Criação Multimídia:**
   - **Audio Overview (Podcast):** Gera uma conversa em áudio dinâmica com 2 apresentadores especialistas (Alex e Sam).
   - **Apresentação de Slides (Slide Deck 16:9):** Cria slides executivos com notas de orador.
   - **Vídeo Narrado por IA:** Animação de cenas com narração por voz e legendas sincronizadas.
   - **Mapas Mentais:** Diagramas visuais interativos em Mermaid.
   - **Flashcards 3D:** Cartões de memorização com teste prático.
`;

      const starterSource = {
        id: "source-guide-1",
        notebook_id: starterId,
        title: "Guia Oficial - Gemini Notebook OS.md",
        type: "markdown",
        content_text: starterContent,
        char_count: starterContent.length,
        is_active: 1,
        created_at: now
      };

      this.saveNotebooks([starterNotebook]);
      this.saveSources([starterSource]);
    }
  }
}

window.DB = new LocalStore();
