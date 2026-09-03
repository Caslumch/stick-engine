/**
 * Endereco dos servicos. Ponto unico: nada de URL literal espalhada.
 *
 * Remoto (vai para a VPS):
 *   API  — NestJS, conversa e memoria
 *   TTS  — engine "edge" apenas; kokoro/qwen exigem GPU e ficam de fora
 *
 * Local (fica na maquina, porque depende de hardware daqui):
 *   WAKEWORD — abre o microfone
 *   OLLAMA   — modelo local
 *
 * Em dev tudo aponta para localhost e nada muda. Para usar a VPS,
 * defina no .env do desktop:
 *   VITE_API_URL=https://stick.seudominio.com
 *   VITE_TTS_URL=https://stick.seudominio.com/tts
 */

const env = import.meta.env

export const API_URL: string = env.VITE_API_URL ?? 'http://localhost:3000'
export const TTS_URL: string = env.VITE_TTS_URL ?? 'http://localhost:5001'

/** Sempre local: abre o microfone desta maquina. */
export const WAKEWORD_URL: string = env.VITE_WAKEWORD_URL ?? 'http://localhost:5002'

/** Sempre local: modelo rodando nesta maquina. */
export const OLLAMA_URL: string = env.VITE_OLLAMA_URL ?? 'http://localhost:11434'
