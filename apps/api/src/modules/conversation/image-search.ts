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
 * Só extrai nomes que parecem ser produtos reais (com marca/modelo).
 */
export function extractProductNames(text: string): string[] {
  const names: string[] = [];

  // Palavras genéricas que NÃO são nomes de produto
  const GENERIC = /^(resumo|dica|nota|obs|fonte|aten[çc][aã]o|importante|detalhe|pre[çc]o|custo|melhor|momento|mercado|brasil|completo|beneficio|exemplo|op[çc][aã]o|categoria|destaque|qualidade|principal|sexta|segunda|ter[çc]a|quarta|quinta|s[áa]bado|domingo|janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|\d{1,2}\s+de\s+)/i;

  // Marcas conhecidas — se o texto bold contém uma dessas, é produto
  const BRANDS = /sony|samsung|apple|iphone|galaxy|motorola|xiaomi|bose|jbl|sennheiser|akg|nvidia|amd|intel|logitech|razer|corsair|hyperx|asus|dell|lenovo|hp|lg|philips|braun|dyson|nikon|canon|gopro|dji|marshall|beats|airpods|macbook|ipad|pixel|oneplus|oppo|realme|redmi|poco|edifier|audio.technica|shure|beyerdynamic|harman|bang.*olufsen/i;

  // Padrão 1: "1. **Nome do Produto**" ou "- **Nome**" — preferido
  const numberedBold = /(?:^|\n)\s*(?:\d+[.)]\s*|[-•]\s*)\*\*([^*]+)\*\*/g;
  let match;
  while ((match = numberedBold.exec(text)) !== null) {
    const name = match[1].trim();
    if (name.length > 3 && name.length < 60 && !GENERIC.test(name)) {
      names.push(name);
    }
  }

  // Padrão 2: qualquer **bold** que contenha uma marca conhecida
  if (names.length === 0) {
    const boldPattern = /\*\*([^*]+)\*\*/g;
    while ((match = boldPattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (BRANDS.test(name) && name.length < 60) {
        names.push(name);
      }
    }
  }

  // Padrão 3: "1. Nome com Marca" sem bold
  if (names.length === 0) {
    const listPattern = /(?:^|\n)\s*\d+[.)]\s*([A-Z][^\n]{5,50})/g;
    while ((match = listPattern.exec(text)) !== null) {
      const name = match[1].trim().split(/\s*[-–—:]/, 1)[0].trim();
      if (BRANDS.test(name)) {
        names.push(name);
      }
    }
  }

  return [...new Set(names)].slice(0, 5);
}
