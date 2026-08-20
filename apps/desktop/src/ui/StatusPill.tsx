import { useJarvisStore } from '../stores/jarvis.store'
import { STATE_LABELS } from '../app/strings'

/**
 * Pill de status — canto superior esquerdo, sempre visível.
 * Ponto na cor do estado, nome do agente, separador, nome do estado.
 */
export function StatusPill() {
  const state = useJarvisStore((s) => s.state)
  const agentName = useJarvisStore((s) => s.settings['agent.name']) || 'Jarvis'

  return (
    <div className="glass" style={{
      position: 'fixed',
      top: 22,
      left: 24,
      zIndex: 40,
      height: 36,
      padding: '0 16px 0 13px',
      borderRadius: 'var(--r-pill)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 13,
      color: 'var(--t-mid)',
    }}>
      <span style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: 'var(--accent)',
        boxShadow: '0 0 0 4px rgba(var(--accent-rgb), .16)',
        transition: 'background .7s, box-shadow .7s',
      }} />
      <b style={{ fontWeight: 500, color: 'var(--t-hi)' }}>{agentName.toUpperCase()}</b>
      <span style={{ width: 1, height: 14, background: 'var(--g-edge)' }} />
      <span>{STATE_LABELS[state]}</span>
    </div>
  )
}
