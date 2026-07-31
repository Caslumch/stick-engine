import { useRef, useCallback } from 'react'
import { cleanForSpeech } from './cleanForSpeech'

/**
 * Hook de Text-to-Speech via Web Speech API.
 * Ponte temporária até Piper + Tauri.
 *
 * Sem fila — cancel() para tudo imediatamente.
 * Uma utterance por vez.
 */

export interface SpeechSynthesisCallbacks {
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: string) => void
}

export function useSpeechSynthesis(callbacks: SpeechSynthesisCallbacks) {
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks
  const speakingRef = useRef(false)
  const cancelledRef = useRef(false)

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const speak = useCallback((text: string) => {
    if (!isSupported || !text.trim()) return

    const cleaned = cleanForSpeech(text)
    if (!cleaned) return

    speechSynthesis.cancel()
    cancelledRef.current = false
    speakingRef.current = true

    const utterance = new SpeechSynthesisUtterance(cleaned)
    utterance.lang = 'pt-BR'
    utterance.rate = 1.1

    const voices = speechSynthesis.getVoices()
    const ptVoice = voices.find((v) => v.lang.startsWith('pt'))
    if (ptVoice) utterance.voice = ptVoice

    utterance.onstart = () => {
      if (!cancelledRef.current) cbRef.current.onStart?.()
    }

    utterance.onend = () => {
      speakingRef.current = false
      if (!cancelledRef.current) cbRef.current.onEnd?.()
    }

    utterance.onerror = (e) => {
      speakingRef.current = false
      if (e.error !== 'canceled' && !cancelledRef.current) {
        cbRef.current.onError?.(e.error)
      }
    }

    speechSynthesis.speak(utterance)
  }, [isSupported])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    speakingRef.current = false
    if (isSupported) speechSynthesis.cancel()
  }, [isSupported])

  const isSpeaking = useCallback(() => speakingRef.current, [])

  return { speak, cancel, isSpeaking, isSupported }
}
