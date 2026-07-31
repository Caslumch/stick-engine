import { useRef, useCallback, useEffect } from 'react'

/**
 * Wake word detection — escuta continuamente por "Jarvis".
 *
 * No browser: usa Web Speech API em modo contínuo, procura a palavra
 * "Jarvis" nas transcrições parciais.
 *
 * Limitações:
 * - Só funciona no Chrome (Web Speech API)
 * - No Tauri/WebView2 não funciona (sem SpeechRecognition)
 * - Futuramente migrar pra OpenWakeWord (modelo local, funciona offline)
 */

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
}

const WAKE_WORDS = ['jarvis', 'jarves', 'jarvez', 'jarve']

export interface WakeWordOptions {
  /** Callback quando a wake word é detectada */
  onWake: () => void
  /** Se deve escutar (toggle global) */
  enabled: boolean
}

export function useWakeWord({ onWake, enabled }: WakeWordOptions) {
  const recRef = useRef<SpeechRecognitionInstance | null>(null)
  const onWakeRef = useRef(onWake)
  onWakeRef.current = onWake
  const activeRef = useRef(false)
  const cooldownRef = useRef(false)

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const startListening = useCallback(() => {
    if (!isSupported || activeRef.current) return

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const rec = new SR() as SpeechRecognitionInstance
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'pt-BR'

    rec.onresult = (e: SpeechRecognitionEvent) => {
      if (cooldownRef.current) return

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript.toLowerCase().trim()
        if (WAKE_WORDS.some(w => text.includes(w))) {
          // Wake word detectada
          cooldownRef.current = true
          rec.stop()
          activeRef.current = false
          onWakeRef.current()

          // Cooldown de 3s pra não detectar de novo imediatamente
          setTimeout(() => { cooldownRef.current = false }, 3000)
          return
        }
      }
    }

    rec.onerror = () => {
      // no-speech, aborted, etc — reiniciar
      activeRef.current = false
    }

    rec.onend = () => {
      activeRef.current = false
      // Reiniciar automaticamente se ainda habilitado
      if (enabled && !cooldownRef.current) {
        setTimeout(() => startListening(), 500)
      }
    }

    recRef.current = rec
    activeRef.current = true
    rec.start()
  }, [isSupported, enabled])

  const stopListening = useCallback(() => {
    activeRef.current = false
    recRef.current?.abort()
    recRef.current = null
  }, [])

  useEffect(() => {
    if (enabled && isSupported) {
      startListening()
    } else {
      stopListening()
    }
    return () => stopListening()
  }, [enabled, isSupported, startListening, stopListening])

  return { isSupported }
}
