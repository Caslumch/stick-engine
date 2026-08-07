import { useRef, useCallback } from 'react'

/**
 * Hook de Speech-to-Text via Web Speech API.
 * Ponte temporária até Whisper.cpp + Tauri.
 *
 * Expõe start/stop/abort e chama callbacks com transcrições
 * parciais (onInterim) e final (onResult).
 */

// Web Speech API types (não incluídos no TS por padrão)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onspeechend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance
    webkitSpeechRecognition: new () => SpeechRecognitionInstance
  }
}

export interface SpeechRecognitionCallbacks {
  /** Transcrição parcial enquanto fala (para exibir em tempo real) */
  onInterim?: (text: string) => void
  /** Transcrição final quando o reconhecimento termina */
  onResult?: (text: string) => void
  /** Reconhecimento terminou (por qualquer motivo) */
  onEnd?: () => void
  /** Erro no reconhecimento */
  onError?: (error: string) => void
}

export function useSpeechRecognition(callbacks: SpeechRecognitionCallbacks) {
  const recRef = useRef<SpeechRecognitionInstance | null>(null)
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks
  const activeRef = useRef(false) // controla auto-restart

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const start = useCallback(() => {
    if (!isSupported) {
      cbRef.current.onError?.('Speech Recognition não suportado neste navegador')
      return
    }

    // Parar instância anterior se existir
    recRef.current?.abort()
    activeRef.current = true

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'pt-BR'

    rec.onresult = (e: SpeechRecognitionEvent) => {
      // Acumular TODOS os resultados (finais + interim atual)
      // pra não perder o início da fala em frases longas
      let fullTranscript = ''
      let hasNewFinal = false

      for (let i = 0; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript
        fullTranscript += transcript
        if (i >= e.resultIndex && e.results[i].isFinal) {
          hasNewFinal = true
        }
      }

      if (hasNewFinal) {
        cbRef.current.onResult?.(fullTranscript.trim())
      } else {
        cbRef.current.onInterim?.(fullTranscript.trim())
      }
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      // 'network' = sem internet → Web Speech não funciona
      if (e.error === 'network') {
        activeRef.current = false
        cbRef.current.onError?.('network')
        return
      }
      cbRef.current.onError?.(e.error)
    }

    rec.onend = () => {
      // Auto-restart se ainda deveria estar ouvindo
      // (Web Speech pode parar por timeout, rede, etc.)
      if (activeRef.current) {
        try {
          const newRec = new SR()
          newRec.continuous = true
          newRec.interimResults = true
          newRec.lang = 'pt-BR'
          newRec.onresult = rec.onresult
          newRec.onerror = rec.onerror
          newRec.onend = rec.onend
          recRef.current = newRec
          newRec.start()
        } catch {
          activeRef.current = false
          cbRef.current.onEnd?.()
        }
        return
      }
      cbRef.current.onEnd?.()
    }

    recRef.current = rec
    rec.start()
  }, [isSupported])

  const stop = useCallback(() => {
    activeRef.current = false
    recRef.current?.stop()
    recRef.current = null
  }, [])

  const abort = useCallback(() => {
    activeRef.current = false
    recRef.current?.abort()
    recRef.current = null
  }, [])

  return { start, stop, abort, isSupported }
}
