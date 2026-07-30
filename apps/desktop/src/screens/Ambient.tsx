import { useState, useEffect } from 'react'
import { useJarvisStore } from '../stores/jarvis.store'

/**
 * Modo ambiente — overlay fullscreen sobre tudo.
 * Esconde nav, status, dock, transcrição. O orb cresce para 64vh.
 * Relógio, data e próximo compromisso. Sai com esc ou clique.
 * Seção 10 do DESIGN_SYSTEM.md.
 */
export function Ambient() {
  const isAmbient = useJarvisStore((s) => s.isAmbient)
  const setAmbient = useJarvisStore((s) => s.setAmbient)
  const [now, setNow] = useState(new Date())

  // Atualiza o relógio a cada segundo
  useEffect(() => {
    if (!isAmbient) return
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [isAmbient])

  // Esc ou clique fecha
  useEffect(() => {
    if (!isAmbient) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAmbient(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isAmbient, setAmbient])

  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div
      onClick={() => setAmbient(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 'min(10vh, 80px)',
        cursor: 'pointer',
        opacity: isAmbient ? 1 : 0,
        pointerEvents: isAmbient ? 'auto' : 'none',
        transition: 'opacity .46s linear',
      }}
    >
      {/* Relógio */}
      <div style={{
        fontSize: 'clamp(48px, 8vw, 96px)',
        fontWeight: 500,
        color: 'var(--t-hi)',
        letterSpacing: '-.04em',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {time}
      </div>

      {/* Data */}
      <div style={{
        fontSize: 'clamp(14px, 2vw, 20px)',
        fontWeight: 300,
        color: 'var(--t-mid)',
        marginTop: 12,
        textTransform: 'capitalize',
      }}>
        {date}
      </div>

      {/* Próximo compromisso (placeholder — quando houver integração real) */}
      <div style={{
        marginTop: 28,
        padding: '10px 22px',
        borderRadius: 'var(--r-pill)',
        background: 'rgba(var(--accent-rgb), .10)',
        border: '1px solid rgba(var(--accent-rgb), .18)',
        fontSize: 14,
        color: 'var(--t-mid)',
        transition: 'background .7s, border-color .7s',
      }}>
        <span style={{ color: 'var(--accent)', fontWeight: 500, transition: 'color .7s' }}>
          Sem compromissos
        </span>
      </div>
    </div>
  )
}
