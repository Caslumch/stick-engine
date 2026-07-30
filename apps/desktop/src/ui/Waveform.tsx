import { useRef, useEffect, useCallback } from 'react'
import type { AmplitudeState } from '../hooks/useAudioAmplitude'

/**
 * Waveform ao vivo — copiada literal do drawWave() do stick.html.
 * Barras de 3px com 3px de intervalo, cantos arredondados, alfa em rampa.
 * Taxa de amostragem ~45ms. Jitter por amostra.
 * Seção 10 do DESIGN_SYSTEM.md.
 */

const BAR = 3
const GAP = 3
const SAMPLE_INTERVAL = 45
const MAX_SAMPLES = 400

interface WaveformProps {
  amplitude: React.RefObject<AmplitudeState>
  active: boolean
  height?: number
  style?: React.CSSProperties
}

export function Waveform({ amplitude, active, height = 42, style }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const samplesRef = useRef<number[]>([])
  const timerRef = useRef(0)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  const pushSample = useCallback(() => {
    const env = amplitude.current.raw
    // Jitter por amostra: fala real não tem envelope liso
    const v = Math.min(1, env * (0.5 + Math.random() * 0.95) + 0.04)
    samplesRef.current.push(v)
    if (samplesRef.current.length > MAX_SAMPLES) samplesRef.current.shift()
  }, [amplitude])

  // Sampling a 45ms
  useEffect(() => {
    if (!active) return
    samplesRef.current = []
    timerRef.current = window.setInterval(pushSample, SAMPLE_INTERVAL)
    return () => clearInterval(timerRef.current)
  }, [active, pushSample])

  // Draw loop
  useEffect(() => {
    if (!active) return
    let raf = 0
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      if (!rect.width) { raf = requestAnimationFrame(draw); return }

      const cw = Math.round(rect.width * dpr)
      const ch = Math.round(rect.height * dpr)
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw
        canvas.height = ch
      }

      const g = canvas.getContext('2d')!
      const w = cw
      const h = ch
      const mid = h / 2
      g.clearRect(0, 0, w, h)

      const step = (BAR + GAP) * dpr
      const bw = BAR * dpr
      const n = Math.max(1, Math.floor(w / step))
      const samples = samplesRef.current

      // Lê a cor do acento do CSS
      const accentStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
      const [r0, g0, b0] = hexToRgb(accentStyle)

      const off = samples.length - n
      for (let i = 0; i < n; i++) {
        const s = samples[off + i] ?? 0
        const bh = Math.max(bw, s * (h * 0.92))
        const x = i * step + (w - n * step) / 2
        // Rampa de alfa: 28% na mais antiga a 100% na mais recente
        const a = 0.28 + 0.72 * (i / Math.max(1, n - 1))
        g.fillStyle = `rgba(${r0},${g0},${b0},${a})`
        g.beginPath()
        if (g.roundRect) {
          g.roundRect(x, mid - bh / 2, bw, bh, bw / 2)
        } else {
          g.rect(x, mid - bh / 2, bw, bh)
        }
        g.fill()
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [active, dpr])

  return (
    <canvas
      ref={canvasRef}
      style={{
        flex: 1,
        height,
        minWidth: 0,
        display: 'block',
        ...style,
      }}
    />
  )
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.startsWith('#') ? hex : '#4ADFB0'
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
