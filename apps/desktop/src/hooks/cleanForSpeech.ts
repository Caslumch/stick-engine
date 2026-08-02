/** Remove markdown, emojis e formatação antes de sintetizar voz.
 *  Insere pausas naturais entre seções e antes/depois de listas. */
export function cleanForSpeech(text: string): string {
  return text
    // Code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Headers — add pause after
    .replace(/^#{1,6}\s+(.+)$/gm, '$1.')
    // Links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Emojis (unicode ranges)
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FA9F}\u{1FAD0}-\u{1FAFF}]/gu, '')
    // Bullet points — keep content, add period for pause
    .replace(/^[\s]*[-*+]\s+(.+)$/gm, '$1.')
    // Numbered lists — keep number for context
    .replace(/^\s*(\d+)\.\s+(.+)$/gm, '$1, $2.')
    // JSON/code artifacts
    .replace(/\{[^}]*"name"[^}]*\}/g, '')
    // Double newlines → sentence break (natural pause)
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    // Clean up duplicate periods
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
