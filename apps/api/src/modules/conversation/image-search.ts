/**
 * Busca de imagens via Tavily (primário) ou DuckDuckGo (fallback).
 * Extração de nomes: sem hardcode — pega itens em bold ou lista numerada.
 */

interface ImageResult {
  title: string
  image: string
  thumbnail: string
  source: string
}

/**
 * Busca imagens via Tavily (preciso, usa a API key já configurada).
 */
export async function searchImagesViaTavily(query: string, apiKey: string, limit = 3): Promise<ImageResult[]> {
  try {
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${query} foto imagem`,
        max_results: limit,
        search_depth: 'basic',
        include_images: true,
        include_image_descriptions: true,
      }),
    })

    if (!resp.ok) return []
    const data = await resp.json()

    return (data.images || []).slice(0, limit).map((img: any) => ({
      title: typeof img === 'string' ? query : (img.description || query),
      image: typeof img === 'string' ? img : img.url,
      thumbnail: typeof img === 'string' ? img : img.url,
      source: '',
    }))
  } catch {
    return []
  }
}

/**
 * Busca imagens — tenta Tavily primeiro, DuckDuckGo como fallback.
 */
export async function searchImages(query: string, limit = 3, tavilyApiKey?: string): Promise<ImageResult[]> {
  // Tavily (preciso)
  if (tavilyApiKey) {
    const results = await searchImagesViaTavily(query, tavilyApiKey, limit)
    if (results.length > 0) return results
  }

  // Fallback: DuckDuckGo (grátis mas menos preciso)
  try {
    const tokenResp = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iar=images&iax=images&ia=images`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    const html = await tokenResp.text()
    const vqdMatch = html.match(/vqd=["']([^"']+)/)
    if (!vqdMatch) return []

    const vqd = vqdMatch[1]
    const imgResp = await fetch(
      `https://duckduckgo.com/i.js?l=br-pt&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,,&p=1`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      },
    )

    if (!imgResp.ok) return []
    const data = await imgResp.json()

    return (data.results || []).slice(0, limit).map((r: any) => ({
      title: r.title || query,
      image: r.image || '',
      thumbnail: r.thumbnail || r.image || '',
      source: r.source || '',
    }))
  } catch {
    return []
  }
}

/**
 * Extrai nomes de itens listados na resposta do LLM.
 * Sem hardcode de marcas — pega qualquer item em bold numa lista.
 */
export function extractProductNames(text: string): string[] {
  const names: string[] = []

  // Padrão 1: "1. **Nome**" ou "- **Nome**"
  const listBold = /(?:^|\n)\s*(?:\d+[.)]\s*|[-•]\s*)\*\*([^*]{3,50})\*\*/g
  let match
  while ((match = listBold.exec(text)) !== null) {
    names.push(match[1].trim())
  }

  // Padrão 2: "**Nome** —" ou "**Nome** -"
  if (names.length === 0) {
    const boldDash = /\*\*([^*]{3,50})\*\*\s*[-–—:]/g
    while ((match = boldDash.exec(text)) !== null) {
      names.push(match[1].trim())
    }
  }

  return [...new Set(names)].slice(0, 5)
}
