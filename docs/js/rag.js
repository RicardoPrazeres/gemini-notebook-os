// Client-Side RAG Engine (Chunking, BM25 & Grounding Context Builder)
class ClientRAGEngine {
  chunkText(text, chunkSize = 750, overlap = 120) {
    if (!text) return [];
    const paragraphs = text.split("\n\n");
    const chunks = [];
    let current = "";
    let start = 0;

    for (const para of paragraphs) {
      const cleanPara = para.trim();
      if (!cleanPara) continue;

      if (current.length + cleanPara.length + 2 <= chunkSize) {
        current = current ? `${current}\n\n${cleanPara}` : cleanPara;
      } else {
        if (current) {
          chunks.push({ content: current, char_start: start, char_end: start + current.length });
          start += Math.max(0, current.length - overlap);
        }
        current = cleanPara;
      }
    }

    if (current) {
      chunks.push({ content: current, char_start: start, char_end: start + current.length });
    }
    return chunks;
  }

  tokenize(text) {
    return (text.toLowerCase().match(/\b\w{2,}\b/g) || []);
  }

  searchChunks(notebookId, query, topK = 6) {
    const sources = window.DB.getSources(notebookId).filter(s => s.is_active === 1 || s.is_active === true);
    if (sources.length === 0) return [];

    let allChunks = [];
    sources.forEach(s => {
      const chunks = this.chunkText(s.content_text);
      chunks.forEach((c, idx) => {
        allChunks.push({
          source_id: s.id,
          source_title: s.title,
          chunk_index: idx,
          content: c.content
        });
      });
    });

    if (allChunks.length === 0) return [];

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return allChunks.slice(0, topK);

    // Score chunks by keyword frequency & title match
    const scored = allChunks.map(chunk => {
      let score = 0;
      const textLower = (chunk.content + " " + chunk.source_title).toLowerCase();
      const chunkTokens = this.tokenize(textLower);

      queryTokens.forEach(qt => {
        const count = chunkTokens.filter(t => t === qt).length;
        if (count > 0) {
          score += count * 2.0;
        }
        if (chunk.source_title.toLowerCase().includes(qt)) {
          score += 3.0;
        }
      });

      return { score, chunk };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(item => item.chunk);
  }

  buildGroundingContext(notebookId, query) {
    const chunks = this.searchChunks(notebookId, query, 5);
    const citationsMap = {};
    const contextParts = [];

    if (chunks.length === 0) {
      const sources = window.DB.getSources(notebookId).filter(s => s.is_active);
      sources.slice(0, 3).forEach((s, idx) => {
        const num = idx + 1;
        const excerpt = s.content_text.slice(0, 700);
        contextParts.push(`[Citação ${num} | Fonte: '${s.title}']\n${excerpt}`);
        citationsMap[num] = {
          number: num,
          source_id: s.id,
          source_title: s.title,
          excerpt: excerpt
        };
      });
    } else {
      chunks.forEach((ch, idx) => {
        const num = idx + 1;
        contextParts.push(`[Citação ${num} | Documento: '${ch.source_title}']\n${ch.content}`);
        citationsMap[num] = {
          number: num,
          source_id: ch.source_id,
          source_title: ch.source_title,
          excerpt: ch.content
        };
      });
    }

    return {
      contextText: contextParts.join("\n\n---\n\n"),
      citationsMap
    };
  }
}

window.RAGEngine = new ClientRAGEngine();
