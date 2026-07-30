import { useRef, useEffect, useCallback } from 'react'
import { NAV } from '../app/strings'

type Screen = 'voice' | 'chat' | 'settings'

const ITEMS: { id: Screen; label: string; icon: string }[] = [
  { id: 'voice', label: NAV.voice, icon: 'M12 4v16M8 8v8M16 8v8M4 11v2M20 11v2' },
  { id: 'chat', label: NAV.chat, icon: 'M4 5h16v11H9l-5 4z' },
  { id: 'settings', label: NAV.settings, icon: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4' },
]

/**
 * Nav flutuante com cápsula deslizante.
 * Seção 10 do DESIGN_SYSTEM.md.
 */
export function Nav({ active, onNavigate }: { active: Screen; onNavigate: (s: Screen) => void }) {
  const navRef = useRef<HTMLElement>(null)
  const indRef = useRef<HTMLSpanElement>(null)
  const btnsRef = useRef<Map<string, HTMLButtonElement>>(new Map())

  const slide = useCallback(() => {
    const nav = navRef.current
    const ind = indRef.current
    const btn = btnsRef.current.get(active)
    if (!nav || !ind || !btn) return
    const nb = nav.getBoundingClientRect()
    const bb = btn.getBoundingClientRect()
    ind.style.width = bb.width + 'px'
    ind.style.transform = `translateX(${bb.left - nb.left}px)`
  }, [active])

  useEffect(() => { slide() }, [slide])
  useEffect(() => {
    window.addEventListener('resize', slide)
    return () => window.removeEventListener('resize', slide)
  }, [slide])

  return (
    <nav ref={navRef} className="glass" style={{
      position: 'fixed',
      bottom: 26,
      left: '50%',
      translate: '-50% 0',
      zIndex: 40,
      display: 'flex',
      gap: 2,
      padding: 5,
      borderRadius: 'var(--r-pill)',
    }}>
      <span ref={indRef} style={{
        position: 'absolute',
        top: 5,
        left: 0,
        height: 'calc(100% - 10px)',
        borderRadius: 'var(--r-pill)',
        background: 'var(--fill-2)',
        border: '1px solid var(--g-edge)',
        boxShadow: '0 2px 12px rgba(0,0,0,.18)',
        transition: 'transform .46s var(--sp-morph), width .46s var(--sp-morph)',
      }} />
      {ITEMS.map(({ id, label, icon }) => (
        <button
          key={id}
          ref={(el) => { if (el) btnsRef.current.set(id, el) }}
          onClick={() => onNavigate(id)}
          style={{
            position: 'relative',
            zIndex: 1,
            height: 38,
            padding: '0 20px',
            borderRadius: 'var(--r-pill)',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            color: active === id ? 'var(--t-hi)' : 'var(--t-low)',
            fontSize: 13.5,
            fontWeight: 450,
            transition: 'color .22s',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--f)',
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d={icon} />
          </svg>
          {label}
        </button>
      ))}
    </nav>
  )
}
