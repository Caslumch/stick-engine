import { useState, useEffect } from 'react'
import { useTheme } from '../theme/ThemeProvider'
import { useJarvisStore } from '../stores/jarvis.store'

/**
 * Barra meta — canto superior direito, com context, provider, botão de tema e commands.
 */
export function MetaBar({ onOpenPalette, onOpenReminders }: { onOpenPalette: () => void; onOpenReminders: () => void }) {
  const { toggle: toggleTheme } = useTheme()
  const lastDecision = useJarvisStore((s) => s.lastDecision)
  const settings = useJarvisStore((s) => s.settings)
  const connected = useJarvisStore((s) => s.connected)
  const [reminderCount, setReminderCount] = useState(0)

  // Buscar contagem de lembretes pendentes
  useEffect(() => {
    if (!connected) return
    const fetchCount = () => {
      fetch('http://localhost:3000/api/reminders')
        .then((r) => r.json())
        .then((data) => setReminderCount(Array.isArray(data) ? data.filter((r: any) => !r.completed).length : 0))
        .catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000) // atualizar a cada 30s
    return () => clearInterval(interval)
  }, [connected])

  const modelLabel = lastDecision
    ? `${lastDecision.model} · ${lastDecision.provider}`
    : settings['llm.ollama.model'] || 'llama3.1'

  return (
    <div className="glass" style={{
      position: 'fixed',
      top: 22,
      right: 24,
      zIndex: 40,
      height: 36,
      padding: '0 6px 0 16px',
      borderRadius: 'var(--r-pill)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontSize: 12.5,
      color: 'var(--t-low)',
    }}>
      <span title={lastDecision?.reason || ''}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: lastDecision?.provider === 'cloud' ? 'var(--st-thinking)' : 'var(--st-executing)',
        }} />
        {modelLabel}
      </span>

      {/* Reminders */}
      <button
        onClick={onOpenReminders}
        title="Lembretes"
        style={{ ...qbStyle, position: 'relative' }}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {reminderCount > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            minWidth: 15, height: 15, borderRadius: 8,
            background: 'var(--accent)', color: '#000',
            fontSize: 9, fontWeight: 700, fontFamily: 'var(--f-mono)',
            display: 'grid', placeItems: 'center',
            padding: '0 3px',
          }}>
            {reminderCount}
          </span>
        )}
      </button>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        title="Theme (T)"
        style={qbStyle}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" />
        </svg>
      </button>

      {/* Commands */}
      <button
        onClick={onOpenPalette}
        title="Commands (⌘K)"
        style={qbStyle}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      </button>
    </div>
  )
}

const qbStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  color: 'var(--t-low)',
  background: 'var(--fill-1)',
  border: 'none',
  cursor: 'pointer',
  transition: 'color .2s, background .2s',
  padding: 0,
}
