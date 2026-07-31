import { useRef, useCallback, useEffect } from 'react'

/**
 * Voice Activity Detection — detecta início e fim de fala.
 *
 * - onVoiceStart: dispara quando voz sustentada é detectada
 *   (acima do threshold por `voiceConfirmMs` consecutivos)
 * - onSilence: dispara quando silêncio dura `silenceDuration` ms
 *
 * A exigência de voz sustentada evita falsos positivos
 * por barulhos de fundo curtos.
 */

export interface VADOptions {
  /** Threshold de energia pra considerar "voz" (0-1). Default: 0.015 */
  threshold?: number
  /** Ms de silêncio antes de disparar onSilence. Default: 1500 */
  silenceDuration?: number
  /** Ms de voz contínua antes de confirmar que é fala. Default: 0 (imediato) */
  voiceConfirmMs?: number
  /** Callback quando silêncio é detectado */
  onSilence?: () => void
  /** Callback quando voz sustentada é detectada */
  onVoiceStart?: () => void
}

export function useVAD(options: VADOptions) {
  const {
    threshold = 0.015,
    silenceDuration = 1500,
    voiceConfirmMs = 0,
    onSilence,
    onVoiceStart,
  } = options

  const cbRef = useRef({ onSilence, onVoiceStart })
  cbRef.current = { onSilence, onVoiceStart }

  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef(0)
  const activeRef = useRef(false)

  // Estado interno
  const confirmedSpeakingRef = useRef(false)  // Já confirmou que é fala
  const voiceStartTimeRef = useRef(0)         // Quando voz começou (pra confirmar)
  const silenceStartRef = useRef(0)           // Quando silêncio começou
  const silenceFiredRef = useRef(false)        // Já disparou onSilence

  const start = useCallback((existingStream?: MediaStream) => {
    if (activeRef.current) return

    activeRef.current = true
    confirmedSpeakingRef.current = false
    voiceStartTimeRef.current = 0
    silenceStartRef.current = 0
    silenceFiredRef.current = false

    const run = (stream: MediaStream) => {
      const ctx = new AudioContext()
      ctxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)

      const timeData = new Uint8Array(analyser.fftSize)

      const tick = () => {
        if (!activeRef.current) return

        analyser.getByteTimeDomainData(timeData)

        let sum = 0
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / timeData.length)
        const now = performance.now()

        if (rms > threshold) {
          // Áudio acima do threshold
          silenceStartRef.current = 0
          silenceFiredRef.current = false

          if (!confirmedSpeakingRef.current) {
            if (voiceStartTimeRef.current === 0) {
              voiceStartTimeRef.current = now
            } else if (now - voiceStartTimeRef.current >= voiceConfirmMs) {
              // Voz sustentada confirmada
              confirmedSpeakingRef.current = true
              cbRef.current.onVoiceStart?.()
            }
          }
        } else {
          // Silêncio
          voiceStartTimeRef.current = 0

          if (confirmedSpeakingRef.current) {
            if (silenceStartRef.current === 0) {
              silenceStartRef.current = now
            } else if (now - silenceStartRef.current >= silenceDuration && !silenceFiredRef.current) {
              silenceFiredRef.current = true
              confirmedSpeakingRef.current = false
              cbRef.current.onSilence?.()
              return
            }
          }
        }

        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    if (existingStream) {
      run(existingStream)
    } else {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(run).catch(() => {})
    }
  }, [threshold, silenceDuration, voiceConfirmMs])

  const stop = useCallback(() => {
    activeRef.current = false
    cancelAnimationFrame(rafRef.current)
    ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
  }, [])

  useEffect(() => {
    return () => { activeRef.current = false; cancelAnimationFrame(rafRef.current) }
  }, [])

  return { start, stop }
}
