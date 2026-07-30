import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook central de áudio — seção 8 do DESIGN_SYSTEM.md.
 *
 * Um AnalyserNode (fftSize 256) com ataque rápido (~0.5) e decaimento lento (~0.08)
 * alimenta ao mesmo tempo o orb, o anel do mic e a waveform.
 *
 * O orb consome a amplitude SUAVIZADA.
 * A waveform consome a amplitude CRUA.
 */

export interface AmplitudeState {
  /** Amplitude suavizada (para orb e anel do mic) */
  smoothed: number
  /** Amplitude crua (para waveform) */
  raw: number
}

export function useAudioAmplitude(active: boolean) {
  const state = useRef<AmplitudeState>({ smoothed: 0, raw: 0 })
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const activeRef = useRef(active)
  activeRef.current = active

  const start = useCallback(async () => {
    if (ctxRef.current) return

    try {
      const ctx = new AudioContext()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)

      ctxRef.current = ctx
      analyserRef.current = analyser
      streamRef.current = stream

      if (ctx.state === 'suspended') await ctx.resume()

      const timeData = new Uint8Array(analyser.fftSize)

      const tick = () => {
        if (!activeRef.current) {
          // Decay suave
          state.current.smoothed *= 0.92
          state.current.raw *= 0.85
          rafRef.current = requestAnimationFrame(tick)
          return
        }

        analyser.getByteTimeDomainData(timeData)

        // RMS
        let sum = 0
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.min(1, Math.sqrt(sum / timeData.length) * 3.5)

        // Crua
        state.current.raw = rms

        // Suavizada: ataque rápido (~0.5), decaimento lento (~0.08)
        const s = state.current.smoothed
        state.current.smoothed = rms > s
          ? s + (rms - s) * 0.5
          : s + (rms - s) * 0.08

        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      console.warn('[audio] Microfone indisponível:', err)
    }
  }, [])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
    analyserRef.current = null
    streamRef.current = null
    state.current = { smoothed: 0, raw: 0 }
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { amplitude: state, start, stop }
}
