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

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const start = useCallback(() => {
    if (!isSupported) {
      cbRef.current.onError?.('Speech Recognition não suportado neste navegador')
      return
    }

    // Parar instância anterior se existir
    recRef.current?.abort()

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'pt-BR'

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }

      if (interim) cbRef.current.onInterim?.(interim)
      if (final) cbRef.current.onResult?.(final)
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      // 'no-speech' e 'aborted' não são erros reais
      if (e.error === 'no-speech' || e.error === 'aborted') return
      cbRef.current.onError?.(e.error)
    }

    rec.onend = () => {
      cbRef.current.onEnd?.()
    }

    recRef.current = rec
    rec.start()
  }, [isSupported])

  const stop = useCallback(() => {
    recRef.current?.stop()
    recRef.current = null
  }, [])

  const abort = useCallback(() => {
    recRef.current?.abort()
    recRef.current = null
  }, [])

  return { start, stop, abort, isSupported }
}
