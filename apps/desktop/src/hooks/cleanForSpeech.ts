/** Remove markdown, URLs, fontes e formatação antes de sintetizar voz.
 *  O objetivo é texto que soe natural quando falado. */
export function cleanForSpeech(text: string): string {
  return text
    // Code blocks — não falar código
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Headers — add pause after
    .replace(/^#{1,6}\s+(.+)$/gm, '$1.')
    // Links com texto — manter só o texto, remover URL
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // URLs soltas — remover completamente (não falar URLs)
    .replace(/https?:\/\/[^\s)]+/g, '')
    // Parênteses com domínios — remover (ex: "(silescore.com.br)")
    .replace(/\([a-z0-9.-]+\.[a-z]{2,}\)/gi, '')
    // "Fonte:", "Referência:", "Source:" — remover linha inteira
    .replace(/^.*(fonte|referencia|source|via|link):?\s*.*$/gim, '')
    // Images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Emojis
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FA9F}\u{1FAD0}-\u{1FAFF}]/gu, '')
    // Bullet points — keep content, add period for pause
    .replace(/^[\s]*[-*+]\s+(.+)$/gm, '$1.')
    // Numbered lists
    .replace(/^\s*(\d+)\.\s+(.+)$/gm, '$1, $2.')
    // JSON/code artifacts
    .replace(/\{[^}]*"name"[^}]*\}/g, '')
    // Double newlines → sentence break
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    // Clean up
    .replace(/\.{2,}/g, '.')
    .replace(/\(\s*\)/g, '')  // parênteses vazios após remoção
    .replace(/\s{2,}/g, ' ')
    .trim()
}
