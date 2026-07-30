import { useState, useRef, useEffect, useCallback } from 'react'
import { useJarvisStore } from '../stores/jarvis.store'
import { useTheme } from '../theme/ThemeProvider'

/**
 * Paleta de comandos (⌘K) — seção 10 do DESIGN_SYSTEM.md.
 * Intercepta ⌘K antes de qualquer outro handler.
 * Dá blur() no input ao fechar (senão o próximo atalho de tecla é engolido).
 */

interface Command {
  group: string
  name: string
  description: string
  shortcut?: string
  icon: string
  run: () => void
}

export function CommandPalette({ externalOpen, onExternalOpenChange }: {
  externalOpen?: boolean
  onExternalOpenChange?: (v: boolean) => void
} = {}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen ?? internalOpen
  const setOpen = (v: boolean) => {
    setInternalOpen(v)
    onExternalOpenChange?.(v)
  }
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Sincronizar quando externalOpen muda
  useEffect(() => {
    if (externalOpen !== undefined) {
      setInternalOpen(externalOpen)
      if (externalOpen) {
        setQuery('')
        setSelected(0)
        setTimeout(() => inputRef.current?.focus(), 40)
      } else {
        inputRef.current?.blur()
      }
    }
  }, [externalOpen])

  const setView = useJarvisStore((s) => s.setView)
  const setState = useJarvisStore((s) => s.setState)
  const { toggle: toggleTheme } = useTheme()

  const commands: Command[] = [
    { group: 'Sessão', name: 'Nova conversa', description: 'Iniciar uma conversa nova', icon: 'M12 5v14M5 12h14',
      run: () => { useJarvisStore.getState().newConversation(); setView('chat') } },
    { group: 'Sessão', name: 'Abrir chat', description: 'Ir para o chat', shortcut: '2', icon: 'M4 5h16v11H9l-5 4z',
      run: () => setView('chat') },
    { group: 'Sessão', name: 'Abrir voz', description: 'Ir para o orb', shortcut: '1', icon: 'M12 4v16M8 8v8M16 8v8',
      run: () => setView('voice') },
    { group: 'Sessão', name: 'Interromper', description: 'Parar o que o agente está fazendo', icon: 'M6 6h12v12H6z',
      run: () => setState('idle') },
    { group: 'Vista', name: 'Trocar tema', description: 'Claro e escuro', shortcut: 'T', icon: 'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z',
      run: toggleTheme },
    { group: 'Vista', name: 'Abrir ajustes', description: 'Todas as preferências', shortcut: '3', icon: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2M12 19v2M3 12h2M19 12h2',
      run: () => setView('settings') },
    { group: 'Vista', name: 'Modo ambiente', description: 'Orb em tela cheia com relógio', shortcut: 'A', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 3',
      run: () => useJarvisStore.getState().setAmbient(true) },
  ]

  const filtered = query.trim()
    ? commands.filter((c) =>
        `${c.name} ${c.description} ${c.group}`.toLowerCase().includes(query.toLowerCase())
      )
    : commands

  const toggle = useCallback((v: boolean) => {
    setOpen(v)
    if (v) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 40)
    } else {
      inputRef.current?.blur()
    }
  }, [])

  const fire = useCallback(() => {
    const cmd = filtered[selected]
    toggle(false)
    if (cmd) setTimeout(cmd.run, 80)
  }, [filtered, selected, toggle])

  // ⌘K interceptor — antes de qualquer outro handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        e.stopPropagation()
        toggle(!open)
        return
      }
      if (!open) return
      if (e.key === 'Escape') { toggle(false); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); return }
      if (e.key === 'Enter') { e.preventDefault(); fire(); return }
    }
    // Capture phase para interceptar antes de tudo
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open, toggle, fire, filtered.length])

  // Scroll item selecionado para visível
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-selected="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  return (
    <>
      {/* Scrim */}
      <div
        onClick={() => toggle(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(8, 12, 10, .42)',
          backdropFilter: 'blur(10px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .26s linear',
          zIndex: 60,
        }}
      />

      {/* Painel */}
      <div
        className="glass"
        style={{
          position: 'fixed',
          top: '16vh',
          left: '50%',
          translate: '-50% 0',
          width: 'min(580px, calc(100% - 48px))',
          zIndex: 61,
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transform: open ? 'none' : 'translateY(-8px) scale(.98)',
          transition: 'opacity .18s linear, transform .34s var(--sp)',
        }}
      >
        {/* Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 20px',
          borderBottom: '1px solid var(--hair)',
        }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="var(--t-low)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <circle cx={11} cy={11} r={7} /><path d="M20 20l-4-4" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Pergunte ao STICK, ou digite um comando..."
            autoComplete="off"
            style={{
              flex: 1,
              fontSize: 16,
              color: 'var(--t-hi)',
              letterSpacing: '-.01em',
              background: 'none',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--f)',
            }}
          />
          <span style={{
            fontFamily: 'var(--f-mono)',
            fontSize: 11,
            color: 'var(--t-low)',
            padding: '3px 8px',
            borderRadius: 6,
            background: 'var(--fill-1)',
          }}>
            esc
          </span>
        </div>

        {/* Lista */}
        <div ref={listRef} style={{
          maxHeight: 'min(56vh, 420px)',
          overflowY: 'auto',
          padding: 8,
        }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: '26px 14px',
              textAlign: 'center',
              color: 'var(--t-low)',
              fontSize: 14,
            }}>
              Nada encontrado. Pressione ↵ para perguntar ao STICK.
            </div>
          ) : (
            (() => {
              let lastGroup = ''
              return filtered.map((cmd, i) => {
                const showGroup = cmd.group !== lastGroup
                lastGroup = cmd.group
                const isSel = i === selected
                return (
                  <div key={cmd.name}>
                    {showGroup && (
                      <div style={{
                        fontSize: 11.5,
                        color: 'var(--t-ghost)',
                        padding: '10px 12px 6px',
                        fontWeight: 500,
                      }}>
                        {cmd.group}
                      </div>
                    )}
                    <button
                      data-selected={isSel}
                      onClick={() => { setSelected(i); fire() }}
                      onMouseEnter={() => setSelected(i)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 13,
                        padding: '11px 12px',
                        borderRadius: 'var(--r-xs)',
                        cursor: 'pointer',
                        color: 'var(--t-mid)',
                        width: '100%',
                        textAlign: 'left',
                        background: isSel ? 'var(--fill-2)' : 'none',
                        border: 'none',
                        fontFamily: 'var(--f)',
                      }}
                    >
                      <span style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        display: 'grid',
                        placeItems: 'center',
                        background: isSel ? 'rgba(var(--accent-rgb), .22)' : 'var(--fill-1)',
                        color: isSel ? 'var(--accent)' : 'var(--t-mid)',
                        flex: '0 0 28px',
                      }}>
                        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                          <path d={cmd.icon} />
                        </svg>
                      </span>
                      <span style={{ flex: 1 }}>
                        <span style={{ fontSize: 14.5, color: 'var(--t-hi)', fontWeight: 450, display: 'block' }}>
                          {cmd.name}
                        </span>
                        <span style={{ fontSize: 12.5, color: 'var(--t-low)', fontWeight: 400 }}>
                          {cmd.description}
                        </span>
                      </span>
                      {cmd.shortcut && (
                        <span style={{
                          fontFamily: 'var(--f-mono)',
                          fontSize: 11,
                          color: 'var(--t-low)',
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: 'var(--fill-1)',
                        }}>
                          {cmd.shortcut}
                        </span>
                      )}
                    </button>
                  </div>
                )
              })
            })()
          )}
        </div>
      </div>
    </>
  )
}
