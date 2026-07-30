import { useState, useRef } from 'react'
import { CreateMenu } from './CreateMenu'

/**
 * Composer — barra de vidro 20px fixa acima da nav.
 * Com botão + (create), input, mic e enviar.
 * Seção 10 do DESIGN_SYSTEM.md.
 */
export function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [input, setInput] = useState('')
  const createRef = useRef<HTMLButtonElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass"
      style={{
        position: 'fixed',
        bottom: 96,
        left: '50%',
        translate: '-50% 0',
        width: 'min(700px, calc(100% - 48px))',
        height: 60,
        borderRadius: 'var(--r-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 8px',
        zIndex: 35,
      }}
    >
      {/* + Create button */}
      <CreateMenu triggerRef={createRef} />

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Message STICK…"
        style={{
          flex: 1,
          fontSize: 15,
          color: 'var(--t-hi)',
          padding: '0 6px',
          background: 'none',
          border: 'none',
          outline: 'none',
          fontFamily: 'var(--f)',
        }}
      />

      {/* Mic */}
      <button
        type="button"
        style={iconBtnStyle}
      >
        <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <rect x={9} y={3} width={6} height={11} rx={3} />
          <path d="M5 11a7 7 0 0 0 14 0" />
        </svg>
      </button>

      {/* Send */}
      <button
        type="submit"
        style={{
          ...iconBtnStyle,
          color: 'var(--accent)',
          transition: 'color .7s, background .2s',
        }}
      >
        <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h13M12 6l6 6-6 6" />
        </svg>
      </button>
    </form>
  )
}

const iconBtnStyle: React.CSSProperties = {
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
}
