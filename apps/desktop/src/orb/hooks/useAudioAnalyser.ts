import { useEffect, useRef } from 'react'

export type AudioFeatures = {
  /** amplitude RMS, 0..1, já suavizada */
  volume: number
  /** centroide espectral normalizado, 0..1 — grave -> agudo */
  pitch: number
  /** energia das altas frequências, 0..1 */
  energy: number
}

export type AudioSource =
  | { kind: 'none' }
  | { kind: 'mic' }
  | { kind: 'element'; element: HTMLMediaElement }
  | { kind: 'stream'; stream: MediaStream }
  | { kind: 'simulated'; intensity?: number }

/**
 * Extrai volume/pitch/energy de uma fonte de áudio a ~60fps.
 *
 * Retorna um ref em vez de state de propósito: a orb lê esses valores dentro do
 * useFrame do R3F, e re-renderizar o React 60x por segundo seria desperdício.
 */
export function useAudioAnalyser(source: AudioSource) {
  const features = useRef<AudioFeatures>({ volume: 0, pitch: 0.5, energy: 0 })

  useEffect(() => {
    let cancelled = false
    let raf = 0
    let ctx: AudioContext | null = null
    let node: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null
    let micStream: MediaStream | null = null

    const decay = () => {
      // Sem fonte ativa, cai suavemente para o repouso em vez de zerar de golpe.
      const f = features.current
      f.volume += (0 - f.volume) * 0.08
      f.energy += (0 - f.energy) * 0.08
      f.pitch += (0.5 - f.pitch) * 0.08
    }

    if (source.kind === 'none') {
      const tick = () => {
        if (cancelled) return
        decay()
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return () => {
        cancelled = true
        cancelAnimationFrame(raf)
      }
    }

    if (source.kind === 'simulated') {
      const intensity = source.intensity ?? 1
      const start = performance.now()
      const tick = () => {
        if (cancelled) return
        const t = (performance.now() - start) / 1000

        // Envelope de fala falsa: sílabas rápidas dentro de frases com pausas.
        const syllable = Math.abs(Math.sin(t * 7.3)) * Math.abs(Math.sin(t * 3.1))
        const phrase = Math.max(0, Math.sin(t * 0.45)) ** 0.5
        const target = syllable * phrase * intensity

        const f = features.current
        f.volume += (target - f.volume) * 0.25
        f.pitch += (0.5 + Math.sin(t * 1.7) * 0.3 - f.pitch) * 0.06
        f.energy += (target * 0.8 - f.energy) * 0.2

        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return () => {
        cancelled = true
        cancelAnimationFrame(raf)
      }
    }

    const setup = async () => {
      try {
        ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        analyser.smoothingTimeConstant = 0.75

        if (source.kind === 'mic') {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          if (cancelled) {
            micStream.getTracks().forEach((t) => t.stop())
            return
          }
          node = ctx.createMediaStreamSource(micStream)
          node.connect(analyser)
        } else if (source.kind === 'stream') {
          node = ctx.createMediaStreamSource(source.stream)
          node.connect(analyser)
        } else {
          node = ctx.createMediaElementSource(source.element)
          node.connect(analyser)
          // O TTS precisa continuar audível, então o analyser não é o fim da cadeia.
          analyser.connect(ctx.destination)
        }

        if (ctx.state === 'suspended') await ctx.resume()

        const timeData = new Uint8Array(analyser.fftSize)
        const freqData = new Uint8Array(analyser.frequencyBinCount)
        const nyquist = ctx.sampleRate / 2

        const tick = () => {
          if (cancelled) return
          analyser.getByteTimeDomainData(timeData)
          analyser.getByteFrequencyData(freqData)

          // RMS no domínio do tempo — mais estável que pegar o pico.
          let sum = 0
          for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / timeData.length)
          // Escala para 0..1 numa faixa útil: fala normal fica em ~0.05-0.3 de RMS.
          const volume = Math.min(1, rms * 3.5)

          // Centroide espectral = "brilho" percebido, bom proxy de pitch.
          let weighted = 0
          let total = 0
          let highs = 0
          for (let i = 0; i < freqData.length; i++) {
            const mag = freqData[i] / 255
            weighted += mag * i
            total += mag
            if (i > freqData.length * 0.5) highs += mag
          }
          const centroidHz = total > 0 ? (weighted / total) * (nyquist / freqData.length) : 0
          // Log scale: a percepção de altura é logarítmica, 0..~4kHz cobre a voz.
          const pitch = total > 0 ? Math.min(1, Math.log2(1 + centroidHz / 80) / 6) : 0.5
          const energy = Math.min(1, (highs / (freqData.length * 0.5)) * 2.5)

          const f = features.current
          const smooth = (cur: number, target: number, up: number, down: number) =>
            cur + (target - cur) * (target > cur ? up : down)

          // Ataque rápido, decaimento lento: acompanha a sílaba sem tremer.
          f.volume = smooth(f.volume, volume, 0.45, 0.12)
          f.pitch = smooth(f.pitch, pitch, 0.1, 0.1)
          f.energy = smooth(f.energy, energy, 0.35, 0.1)

          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch (err) {
        console.warn('[orb] audio indisponível, caindo para repouso:', err)
        const tick = () => {
          if (cancelled) return
          decay()
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      }
    }

    setup()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      node?.disconnect()
      micStream?.getTracks().forEach((t) => t.stop())
      // MediaElementSource é permanente por elemento; fechar o contexto é o que libera.
      ctx?.close().catch(() => {})
    }
  }, [source.kind, (source as any).element, (source as any).stream, (source as any).intensity])

  return features
}
