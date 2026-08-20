import { useState, useCallback, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ----------------------------------------------------------------
   DragTrash — lixeira global que aparece quando qualquer
   componente arrastável está sendo movido.
   Uso: importar dragTrash e chamar dragTrash.start() / .end() / .move()
   ---------------------------------------------------------------- */

interface DragTrashState {
  active: boolean
  over: boolean
  onDrop: (() => void) | null
}

// Estado global (sem React — pra ser acessível de qualquer lugar)
export const dragTrash: {
  start: (onDrop: () => void) => void
  move: (clientY: number) => void
  end: () => void
  _listeners: Set<(state: DragTrashState) => void>
  _state: DragTrashState
} = {
  _state: { active: false, over: false, onDrop: null },
  _listeners: new Set(),

  start(onDrop: () => void) {
    this._state = { active: true, over: false, onDrop }
    this._listeners.forEach((fn) => fn(this._state))
  },

  move(clientY: number) {
    const over = clientY > window.innerHeight - 120
    if (over !== this._state.over) {
      this._state = { ...this._state, over }
      this._listeners.forEach((fn) => fn(this._state))
    }
  },

  end() {
    if (this._state.over && this._state.onDrop) {
      this._state.onDrop()
    }
    this._state = { active: false, over: false, onDrop: null }
    this._listeners.forEach((fn) => fn(this._state))
  },
}

/** Componente visual da lixeira — montar uma vez no App */
export function DragTrashZone() {
  const [state, setState] = useState<DragTrashState>({ active: false, over: false, onDrop: null })

  // Subscrever ao estado global
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const listener = (s: DragTrashState) => setState({ ...s })
    dragTrash._listeners.add(listener)
    return () => { dragTrash._listeners.delete(listener) }
  }, [])

  return (
    <div ref={ref}>
      <AnimatePresence>
        {state.active ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              bottom: 170,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 25,
              pointerEvents: 'none',
            }}
          >
            <div style={{
              width: 60, height: 60,
              borderRadius: '50%',
              background: state.over ? 'rgba(255, 107, 107, .3)' : 'rgba(255, 255, 255, .08)',
              border: `2px solid ${state.over ? 'var(--st-error)' : 'rgba(255, 255, 255, .15)'}`,
              display: 'grid', placeItems: 'center',
              transition: 'all .15s',
              transform: state.over ? 'scale(1.2)' : 'none',
              boxShadow: state.over ? '0 0 30px rgba(255, 107, 107, .3)' : 'none',
            }}>
              <span style={{ fontSize: 24, filter: state.over ? 'none' : 'grayscale(1) opacity(.5)' }}>🗑</span>
            </div>
            <div style={{
              textAlign: 'center', marginTop: 6,
              fontSize: 10, color: state.over ? 'var(--st-error)' : 'var(--t-ghost)',
              fontFamily: 'var(--f-mono)',
            }}>
              {state.over ? 'soltar pra deletar' : 'arraste aqui'}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/** Hook pra saber se algo está sendo arrastado */
export function useIsDragging(): boolean {
  return useSyncExternalStore(
    (cb) => { dragTrash._listeners.add(cb as any); return () => { dragTrash._listeners.delete(cb as any) } },
    () => dragTrash._state.active,
  )
}
