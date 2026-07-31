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

  const splitSentences = (text: string): string[] => {
    const parts = text.split(/(?<=[.!?;:])\s+/)
    const sentences: string[] = []
    let current = ''
    for (const part of parts) {
      if (current.length + part.length > 200) {
        if (current) sentences.push(current.trim())
        current = part
      } else {
        current += (current ? ' ' : '') + part
      }
    }
    if (current.trim()) sentences.push(current.trim())
    return sentences.length > 0 ? sentences : [text]
  }

  const speakOne = async (sentence: string): Promise<void> => {
    if (cancelledRef.current) return

    const settings = useJarvisStore.getState().settings
    const engine = settings['tts.engine'] || 'edge'
    const voice = settings['tts.voice'] || ''

    const resp = await fetch(`${TTS_URL}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sentence, engine, voice }),
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

      for (const sentence of sentences) {
        if (cancelledRef.current) break
        await speakOne(sentence)
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
