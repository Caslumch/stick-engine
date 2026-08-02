import { useRef, useEffect } from 'react'

/**
 * Wake word detection — escuta continuamente por "Jarvis".
 *
 * Usa Web Speech API em modo contínuo (Chrome only).
 * Quando detecta a palavra, chama onWake e pausa por 3s.
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
  onWake: () => void
  enabled: boolean
}

export function useWakeWord({ onWake, enabled }: WakeWordOptions) {
  const onWakeRef = useRef(onWake)
  onWakeRef.current = onWake
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const recRef = useRef<SpeechRecognitionInstance | null>(null)
  const cooldownRef = useRef(false)
  const mountedRef = useRef(true)

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    mountedRef.current = true

    if (!enabled || !isSupported) return

    let restartTimer: number

    const createAndStart = () => {
      if (!mountedRef.current || !enabledRef.current || cooldownRef.current) return

      // Limpar instância anterior
      if (recRef.current) {
        try { recRef.current.abort() } catch {}
        recRef.current = null
      }

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
            console.log('[WakeWord] "Jarvis" detectado!')
            cooldownRef.current = true
            try { rec.abort() } catch {}
            recRef.current = null
            onWakeRef.current()

            // Cooldown — não redetectar por 5s (dá tempo do mic/stt serem usados)
            setTimeout(() => {
              cooldownRef.current = false
              if (mountedRef.current && enabledRef.current) {
                createAndStart()
              }
            }, 5000)
            return
          }
        }
      }

      rec.onerror = () => {
        // Ignorar — onend vai reiniciar
      }

      rec.onend = () => {
        recRef.current = null
        // Reiniciar após pausa (evita loop agressivo)
        if (mountedRef.current && enabledRef.current && !cooldownRef.current) {
          restartTimer = window.setTimeout(createAndStart, 1000)
        }
      }

      recRef.current = rec
      try {
        rec.start()
        console.log('[WakeWord] Escutando...')
      } catch {
        // Pode falhar se outro reconhecimento está ativo
        restartTimer = window.setTimeout(createAndStart, 2000)
      }
    }

    // Delay inicial pra não competir com outros hooks no mount
    const initTimer = window.setTimeout(createAndStart, 1500)

    return () => {
      mountedRef.current = false
      clearTimeout(initTimer)
      clearTimeout(restartTimer)
      if (recRef.current) {
        try { recRef.current.abort() } catch {}
        recRef.current = null
      }
    }
  // Só re-executar quando enabled muda de verdade
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isSupported])

  return { isSupported }
}
