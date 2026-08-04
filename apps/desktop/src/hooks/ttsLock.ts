/**
 * Lock global do TTS — enquanto active=true, eventos externos
 * não devem mudar o estado do agente (speaking é controlado pelo frontend).
 */
export const ttsLock = { active: false }
