/** Remove markdown, URLs, fontes e formatação antes de sintetizar voz.
 *  O objetivo é texto que soe natural quando falado. */
export function cleanForSpeech(text: string): string {
  return text
    // Citações da Responses API
    .replace(/\[\[cite[^\]]*\]\]/g, '')
    .replace(/\u3010[^】]*\u3011/g, '')
    // Code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Bold/italic — manter só o texto
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Headers (###, ##, #) — remover os hashes, manter texto
    .replace(/#{1,6}\s*/g, '')
    // Links markdown — manter só o texto
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // URLs soltas
    .replace(/https?:\/\/[^\s)]+/g, '')
    // Domínios entre parênteses
    .replace(/\([a-z0-9.-]+\.[a-z]{2,}\)/gi, '')
    // "Ver no site", "Fonte:", etc. — remover completamente
    .replace(/ver no site/gi, '')
    .replace(/veja no site/gi, '')
    .replace(/confira no site/gi, '')
    .replace(/acesse o site/gi, '')
    .replace(/saiba mais/gi, '')
    .replace(/^.*(fonte|referencia|source):?\s*.*$/gim, '')
    // Imagens markdown
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Emojis
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FA9F}\u{1FAD0}-\u{1FAFF}]/gu, '')
    // Labels repetitivos que não soam bem falados
    .replace(/\b(Destaque|Características|Ideal para|Dica):\s*/gi, '')
    // Bullet points
    .replace(/^[\s]*[-*+•]\s+/gm, '')
    // Numbered lists — remover "1. " mas manter texto
    .replace(/^\s*\d+[.)]\s*/gm, '')
    // JSON artifacts
    .replace(/\{[^}]*"name"[^}]*\}/g, '')
    // Newlines → pausas
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    // Cleanup
    .replace(/\.{2,}/g, '.')
    .replace(/,\s*\./g, '.')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
