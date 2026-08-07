/**
 * Busca de imagens via DuckDuckGo (grátis, sem API key).
 * Usado pra enriquecer respostas com imagens de produtos.
 */

interface ImageResult {
  title: string
  image: string
  thumbnail: string
  source: string
}

/**
 * Busca imagens pro query usando DuckDuckGo.
 * Retorna até `limit` resultados.
 */
export async function searchImages(query: string, limit = 3): Promise<ImageResult[]> {
  try {
    // Passo 1: pegar o vqd token (necessário pra busca de imagens do DDG)
    const tokenResp = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iar=images&iax=images&ia=images`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    const html = await tokenResp.text();
    const vqdMatch = html.match(/vqd=["']([^"']+)/);
    if (!vqdMatch) return [];

    // Passo 2: buscar imagens
    const vqd = vqdMatch[1];
    const imgResp = await fetch(
      `https://duckduckgo.com/i.js?l=br-pt&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,,&p=1`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      },
    );

    if (!imgResp.ok) return [];
    const data = await imgResp.json();

    return (data.results || []).slice(0, limit).map((r: any) => ({
      title: r.title || query,
      image: r.image || '',
      thumbnail: r.thumbnail || r.image || '',
      source: r.source || '',
    }));
  } catch {
    return [];
  }
}

/**
 * Extrai nomes de produtos/itens de uma resposta do LLM.
 * Procura por padrões numerados ou bold.
 */
export function extractProductNames(text: string): string[] {
  const names: string[] = [];

  // Padrão: "1. **Nome do Produto**" ou "- **Nome**"
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let match;
  while ((match = boldPattern.exec(text)) !== null) {
    const name = match[1].trim();
    // Filtrar nomes muito curtos ou genéricos
    if (name.length > 3 && name.length < 60 && !/^(resumo|dica|nota|obs|fonte)/i.test(name)) {
      names.push(name);
    }
  }

  // Se não achou bold, tentar "1. Nome" ou "- Nome"
  if (names.length === 0) {
    const listPattern = /^[\s]*(?:\d+[.)]\s*|[-•]\s*)([A-Z][^\n.!?]{5,50})/gm;
    while ((match = listPattern.exec(text)) !== null) {
      names.push(match[1].trim());
    }
  }

  // Limitar a 5 produtos
  return [...new Set(names)].slice(0, 5);
}
