import { useRef, useCallback } from 'react'
import { getTTSBus, resumeTTSBus } from './ttsAudioBus'
import { useJarvisStore } from '../stores/jarvis.store'
import { cleanForSpeech } from './cleanForSpeech'

/**
 * TTS via servidor multi-engine (localhost:5001).
 * Funciona no browser e no Tauri.
 *
 * Lê o engine selecionado do zustand store (settings['tts.engine']).
 * Áudio passa pelo ttsAudioBus pra o orb reagir ao áudio real.
 */

const TTS_URL = 'http://localhost:5001'

export interface ServerTTSCallbacks {
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: string) => void
}

export function useServerTTS(callbacks: ServerTTSCallbacks) {
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const cancelledRef = useRef(false)
  const startedRef = useRef(false)

  const BASE_RATES: Record<string, number> = { slow: -15, normal: 0, fast: 20 }

  /**
   * Classify content type for dynamic speech rate.
   * Lists/enumerations → faster. Explanations/greetings → normal. Questions → slightly slower.
   */
  const classifyRate = (sentence: string): string => {
    const settings = useJarvisStore.getState().settings
    const baseSpeed = settings['tts.speed'] || 'normal'
    const dynamicEnabled = settings['tts.dynamicSpeed'] !== 'false'
    const base = BASE_RATES[baseSpeed] ?? 0

    if (!dynamicEnabled) {
      return base >= 0 ? `+${base}%` : `${base}%`
    }

    const s = sentence.trim()
    let offset = 0

    // Lists / enumerations — speak faster
    if (/^\d+[\.\)]\s/.test(s) || /^[-•]\s/.test(s) || /^[a-z]\)\s/i.test(s)) {
      offset = 15
    }
    // Short confirmations — normal speed
    else if (s.length < 30) { offset = 0 }
    // Questions — slightly slower for clarity
    else if (s.endsWith('?')) { offset = -5 }
    // Long explanations — slightly slower
    else if (s.length > 150) { offset = -8 }

    const total = base + offset
    return total >= 0 ? `+${total}%` : `${total}%`
  }

  const splitSentences = (text: string): { text: string; rate: string }[] => {
    const parts = text.split(/(?<=[.!?;:])\s+/)
    const sentences: { text: string; rate: string }[] = []
    let current = ''
    for (const part of parts) {
      if (current.length + part.length > 200) {
        if (current) {
          const t = current.trim()
          sentences.push({ text: t, rate: classifyRate(t) })
        }
        current = part
      } else {
        current += (current ? ' ' : '') + part
      }
    }
    if (current.trim()) {
      const t = current.trim()
      sentences.push({ text: t, rate: classifyRate(t) })
    }
    return sentences.length > 0 ? sentences : [{ text, rate: '+0%' }]
  }

  const speakOne = async (sentence: string, rate: string = '+0%'): Promise<void> => {
    if (cancelledRef.current) return

    const settings = useJarvisStore.getState().settings
    const engine = settings['tts.engine'] || 'edge'
    const voice = settings['tts.voice'] || ''

    const resp = await fetch(`${TTS_URL}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sentence, engine, voice, rate }),
    })

    if (!resp.ok) {
      const body = await resp.text()
      throw new Error(`TTS ${engine}: ${resp.status} - ${body}`)
    }
    if (cancelledRef.current) return

    const audioBytes = await resp.arrayBuffer()

    const bus = getTTSBus()
    await resumeTTSBus()

    const audioBuffer = await bus.ctx.decodeAudioData(audioBytes.slice(0))
    if (cancelledRef.current) return

    return new Promise<void>((resolve) => {
      const source = bus.ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(bus.input)
      sourceRef.current = source

      source.onended = () => {
        sourceRef.current = null
        resolve()
      }

      source.start()
      if (!startedRef.current) { startedRef.current = true; cbRef.current.onStart?.() }
    })
  }

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return

    cancelledRef.current = false
    startedRef.current = false

    try {
      const cleaned = cleanForSpeech(text)
      if (!cleaned) return
      const sentences = splitSentences(cleaned)

      for (let i = 0; i < sentences.length; i++) {
        if (cancelledRef.current) break
        // Prefetch: buscar áudio da próxima frase enquanto a atual toca
        const nextSegment = sentences[i + 1]
        let prefetch: Promise<void> | null = null
        if (nextSegment && !cancelledRef.current) {
          // Pré-aquecer a próxima requisição (o servidor começa a processar)
          prefetch = fetch(`${TTS_URL}/speak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: nextSegment.text,
              engine: useJarvisStore.getState().settings['tts.engine'] || 'edge',
              voice: useJarvisStore.getState().settings['tts.voice'] || '',
              rate: nextSegment.rate,
            }),
          }).then(() => {}).catch(() => {})
        }
        await speakOne(sentences[i].text, sentences[i].rate)
      }

      if (!cancelledRef.current) cbRef.current.onEnd?.()
    } catch (err) {
      sourceRef.current = null
      if (!cancelledRef.current) cbRef.current.onError?.(`Erro no TTS: ${err}`)
    }
  }, [])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    try { sourceRef.current?.stop() } catch {}
    sourceRef.current = null
  }, [])

  const isSpeaking = useCallback(() => sourceRef.current !== null, [])

  return { speak, cancel, isSpeaking }
}

export async function checkServerTTS(): Promise<boolean> {
  try {
    const resp = await fetch(`${TTS_URL}/health`, { signal: AbortSignal.timeout(2000) })
    if (!resp.ok) return false
    const data = await resp.json()
    return data.ready === true
  } catch {
    return false
  }
}
