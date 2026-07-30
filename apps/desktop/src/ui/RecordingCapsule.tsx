import { useRef, useEffect, useState } from 'react'
import { Waveform } from './Waveform'
import type { AmplitudeState } from '../hooks/useAudioAmplitude'

/**
 * Cápsula de gravação — nasce do botão de mic (76px → 430px).
 * Seção 10 do DESIGN_SYSTEM.md.
 *
 * variant="voice" → cápsula grande (76px altura, na tela de voz)
 * variant="chat"  → cápsula pequena (30px altura, dentro do composer)
 */

interface RecordingCapsuleProps {
  active: boolean
  amplitude: React.RefObject<AmplitudeState>
  onDiscard: () => void
  onSend: () => void
  variant?: 'voice' | 'chat'
}

export function RecordingCapsule({
  active,
  amplitude,
  onDiscard,
  onSend,
  variant = 'voice',
}: RecordingCapsuleProps) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(0)
  const timerRef = useRef(0)

  useEffect(() => {
    if (active) {
      startRef.current = performance.now()
      setElapsed(0)
      timerRef.current = window.setInterval(() => {
        setElapsed(performance.now() - startRef.current)
      }, 100)
    } else {
      clearInterval(timerRef.current)
      setElapsed(0)
    }
    return () => clearInterval(timerRef.current)
  }, [active])

  const isVoice = variant === 'voice'
  const h = isVoice ? 76 : 30
  const btnSize = isVoice ? 44 : 38
  const sendSize = isVoice ? 52 : 40
  const waveH = isVoice ? 42 : 30

  return (
    <div
      className="glass"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        translate: '-50% -50%',
        height: h,
        width: active ? (isVoice ? 'min(430px, 86vw)' : '100%') : (isVoice ? 76 : 0),
        borderRadius: 'var(--r-pill)',
        display: 'flex',
        alignItems: 'center',
        gap: isVoice ? 12 : 10,
        padding: `0 ${isVoice ? 8 : 6}px`,
        overflow: 'hidden',
        opacity: active ? 1 : 0,
        pointerEvents: active ? 'auto' : 'none',
        transition: 'width .52s var(--sp-morph), opacity .2s linear',
      }}
    >
      {/* Conteúdo entra 160ms depois do morph */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: isVoice ? 12 : 10,
        flex: 1,
        minWidth: 0,
        opacity: active ? 1 : 0,
        transition: 'opacity .26s linear',
        transitionDelay: active ? '.16s' : '0s',
      }}>
        {/* Descartar */}
        <button
          onClick={onDiscard}
          style={{
            ...roundBtnStyle,
            width: btnSize,
            height: btnSize,
            flex: `0 0 ${btnSize}px`,
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12a8 8 0 1 1 3 6.2M4 12V7M4 12h5" />
          </svg>
        </button>

        {/* Waveform */}
        <Waveform amplitude={amplitude} active={active} height={waveH} />

        {/* Timer */}
        <span style={{
          fontFamily: 'var(--f-mono)',
          fontSize: 13,
          color: 'var(--t-mid)',
          flex: '0 0 auto',
          letterSpacing: '.02em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatTime(elapsed)}
        </span>

        {/* Enviar — único botão sólido */}
        <button
          onClick={onSend}
          style={{
            ...roundBtnStyle,
            width: sendSize,
            height: sendSize,
            flex: `0 0 ${sendSize}px`,
            background: 'var(--accent)',
            color: '#08120E',
            boxShadow: '0 6px 20px -6px rgba(var(--accent-rgb), .8)',
            transition: 'background .7s, transform .2s var(--sp)',
          }}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 3L10.5 13.5M21 3l-6.8 18-3.7-7.5L3 10.2z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

const roundBtnStyle: React.CSSProperties = {
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  color: 'var(--t-low)',
  background: 'var(--fill-1)',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  transition: 'color .2s, background .2s, transform .2s var(--sp)',
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
