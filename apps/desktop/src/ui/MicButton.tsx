import { useJarvisStore } from '../stores/jarvis.store'

/**
 * Botão de microfone — 76px, vidro, com stick reativo.
 * Seção 10 do DESIGN_SYSTEM.md.
 */
export function MicButton({ onClick }: { onClick: () => void }) {
  const state = useJarvisStore((s) => s.state)
  const hot = state === 'listening' || state === 'speaking'
  const disabled = state === 'thinking' || state === 'executing' || state === 'offline'

  return (
    <button
      className="glass"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 76,
        height: 76,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--t-hi)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'transform .24s var(--sp), box-shadow .5s, opacity .3s',
        boxShadow: hot
          ? '0 0 0 1px rgba(var(--accent-rgb), .5), 0 0 40px -6px rgba(var(--accent-rgb), .55), 0 1px 0 var(--g-hi) inset'
          : undefined,
        border: 'none',
        fontFamily: 'var(--f)',
        padding: 0,
      }}
    >
      <svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', zIndex: 2 }}>
        <rect x={9} y={3} width={6} height={11} rx={3} />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  )
}
