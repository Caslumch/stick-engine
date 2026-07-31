/** Remove markdown, emojis e formatação antes de sintetizar voz */
export function cleanForSpeech(text: string): string {
  return text
    // Code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Headers
    .replace(/^#{1,6}\s+/gm, '')
    // Links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Emojis (unicode ranges)
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FA9F}\u{1FAD0}-\u{1FAFF}]/gu, '')
    // Bullet points
    .replace(/^[\s]*[-*+]\s+/gm, '')
    // Numbered lists
    .replace(/^\s*\d+\.\s+/gm, '')
    // JSON/code artifacts
    .replace(/\{[^}]*"name"[^}]*\}/g, '')
    // Multiple spaces/newlines
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
