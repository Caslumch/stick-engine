import { useState, useRef, useEffect } from 'react'

/**
 * Create button — painel que cresce a partir do botão +.
 * Seção 9 (padrão create button) e 10 do DESIGN_SYSTEM.md.
 */

const ITEMS = [
  { label: 'Project', icon: 'M3 7h6l2 2h10v10H3z' },
  { label: 'Notebook', icon: 'M4 3h16a2.5 2.5 0 0 1 0 5H4V3zM8 8h8M8 12h8M8 16h4', rect: { x: 4, y: 3, w: 16, h: 18, rx: 2.5 } },
  { label: 'Notes', icon: 'M8 21h11a2 2 0 0 0 2-2V8', rect: { x: 3, y: 3, w: 13, h: 13, rx: 2.5 } },
  { label: 'Goal', icon: 'M8 4h8v5a4 4 0 0 1-8 0zM12 13v5M9 21h6M16 5h3v2a3 3 0 0 1-3 3M8 5H5v2a3 3 0 0 0 3 3' },
  { label: 'Milestone', icon: 'M6 21V4M6 4h11l-2 4 2 4H6' },
  { label: 'Event', icon: 'M3 10h18M8 3v4M16 3v4', rect: { x: 3, y: 5, w: 18, h: 16, rx: 2.5 } },
]

interface CreateMenuProps {
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

export function CreateMenu({ triggerRef }: CreateMenuProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Posicionar o painel acima do trigger
  useEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return
    const tr = triggerRef.current.getBoundingClientRect()
    const panel = panelRef.current
    panel.style.left = tr.left + 'px'
    panel.style.top = (tr.top - panel.offsetHeight - 16) + 'px'
  }, [open, triggerRef])

  return (
    <>
      {/* Scrim */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(8, 12, 10, .42)',
          backdropFilter: 'blur(10px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .26s linear',
          zIndex: 50,
        }}
      />

      {/* Trigger — o botão + fica no Composer, este componente só controla o estado */}
      <button
        ref={triggerRef as React.RefObject<HTMLButtonElement>}
        onClick={() => setOpen(!open)}
        style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--r-xs)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--t-low)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          transition: 'color .2s, background .2s',
          padding: 0,
        }}
      >
        <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* Painel */}
      <div
        ref={panelRef}
        className="glass"
        style={{
          position: 'fixed',
          zIndex: 51,
          width: 430,
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transform: open ? 'scale(1)' : 'scale(.92)',
          transformOrigin: 'bottom left',
          transition: 'transform .5s var(--sp-morph), opacity .18s linear',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 22px 16px',
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--t-hi)' }}>
            Create new
          </span>
          <button
            onClick={() => setOpen(false)}
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--t-low)',
              background: 'var(--fill-1)',
              border: 'none',
              cursor: 'pointer',
              transition: '.2s',
              padding: 0,
            }}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          padding: '0 14px 16px',
        }}>
          {ITEMS.map((item, i) => (
            <button
              key={item.label}
              onClick={() => setOpen(false)}
              style={{
                aspectRatio: '1 / .92',
                borderRadius: 'var(--r-sm)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                color: 'var(--t-mid)',
                background: 'var(--fill-1)',
                border: '1px solid var(--hair)',
                cursor: 'pointer',
                fontFamily: 'var(--f)',
                opacity: open ? 1 : 0,
                transform: open ? 'none' : 'translateY(8px) scale(.97)',
                transition: `opacity .34s var(--sp), transform .46s var(--sp), color .2s, background .2s, border-color .2s`,
                transitionDelay: open ? `${0.15 + i * 0.026}s` : '0s',
                padding: 0,
              }}
            >
              <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
                {item.rect && (
                  <rect x={item.rect.x} y={item.rect.y} width={item.rect.w} height={item.rect.h} rx={item.rect.rx} />
                )}
                <path d={item.icon} />
              </svg>
              <span style={{ fontSize: 12.5, fontWeight: 450 }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
