import { useRef, useCallback } from 'react'

/**
 * Hook de Text-to-Speech via Web Speech API.
 * Ponte temporária até Piper + Tauri.
 *
 * Fila de áudio: enfileira utterances e executa em sequência.
 * Não sobrepõe falas.
 */

export interface SpeechSynthesisCallbacks {
  /** Começou a falar uma utterance */
  onStart?: () => void
  /** Terminou de falar toda a fila */
  onEnd?: () => void
  /** Erro na síntese */
  onError?: (error: string) => void
}

export function useSpeechSynthesis(callbacks: SpeechSynthesisCallbacks) {
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks
  const queueRef = useRef<string[]>([])
  const speakingRef = useRef(false)

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const processQueue = useCallback(() => {
    if (!isSupported) return
    if (speakingRef.current) return
    if (queueRef.current.length === 0) {
      cbRef.current.onEnd?.()
      return
    }

    const text = queueRef.current.shift()!
    speakingRef.current = true

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'pt-BR'
    utterance.rate = 1.1

    // Tentar achar uma voz pt-BR
    const voices = speechSynthesis.getVoices()
    const ptVoice = voices.find((v) => v.lang.startsWith('pt'))
    if (ptVoice) utterance.voice = ptVoice

    utterance.onstart = () => {
      cbRef.current.onStart?.()
    }

    utterance.onend = () => {
      speakingRef.current = false
      processQueue()
    }

    utterance.onerror = (e) => {
      speakingRef.current = false
      if (e.error !== 'canceled') {
        cbRef.current.onError?.(e.error)
      }
      processQueue()
    }

    speechSynthesis.speak(utterance)
  }, [isSupported])

  const speak = useCallback((text: string) => {
    if (!text.trim()) return
    queueRef.current.push(text)
    if (!speakingRef.current) {
      processQueue()
    }
  }, [processQueue])

  const cancel = useCallback(() => {
    queueRef.current = []
    speakingRef.current = false
    if (isSupported) speechSynthesis.cancel()
  }, [isSupported])

  return { speak, cancel, isSupported }
}
