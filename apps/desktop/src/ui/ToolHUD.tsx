import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { spring, dur, stagger } from '../motion/tokens'
import { TOOL_LABELS } from '../app/strings'
import type { ToolExecution } from '../stores/jarvis.store'

/* ----------------------------------------------------------------
   ToolHUD — painéis operacionais nos LADOS do orb (nunca em cima).
   Posições aleatórias restritas a esquerda e direita.
   ---------------------------------------------------------------- */

interface PolarSlot {
  angle: number
  radius: number
  rotation: number
  side: 'left' | 'right'
}

const MIN_ANGLE_GAP = Math.PI / 5 // ~36° mínimo entre painéis do mesmo lado

function pickSlot(existing: PolarSlot[]): PolarSlot {
  // Alternar lados, começando pelo que tem menos painéis
  const leftCount = existing.filter((s) => s.side === 'left').length
  const rightCount = existing.filter((s) => s.side === 'right').length
  const side = leftCount <= rightCount ? 'left' : 'right'

  // Ângulos: esquerda = -50° a -130°, direita = 50° a 130° (0° = topo)
  const [minDeg, maxDeg] = side === 'left' ? [-130, -50] : [50, 130]
  const sameSide = existing.filter((s) => s.side === side)

  let angle: number
  let attempts = 0
  do {
    const deg = minDeg + Math.random() * (maxDeg - minDeg)
    angle = (deg * Math.PI) / 180
    attempts++
  } while (
    attempts < 25 &&
    sameSide.some((s) => Math.abs(s.angle - angle) < MIN_ANGLE_GAP)
  )

  return {
    angle,
    radius: 0.5 + Math.random() * 0.5,
    rotation: Math.random() * 4 - 2,
    side,
  }
}

function polarToXY(slot: PolarSlot) {
  const r = 260 + slot.radius * 160 // 260–420px do centro
  return {
    x: Math.sin(slot.angle) * r,
    y: -Math.cos(slot.angle) * r * 0.6,
  }
}

// -- Tipos internos ------------------------------------------------

interface HUDEntry {
  exec: ToolExecution
  slot: PolarSlot
  id: string
  enteredAt: number
  doneAt?: number
}

const DISMISS_MS = 4500

// -- Componente principal ------------------------------------------

export function ToolHUD({ executions }: { executions: ToolExecution[] }) {
  const entriesRef = useRef<HUDEntry[]>([])
  const [entries, setEntries] = useState<HUDEntry[]>([])

  useEffect(() => {
    const prev = entriesRef.current
    const next: HUDEntry[] = []
    const usedSlots: PolarSlot[] = []

    for (const exec of executions) {
      const existing = prev.find((e) => e.exec.toolName === exec.toolName)
      if (existing) {
        const entry: HUDEntry = {
          ...existing,
          exec,
          doneAt: exec.status === 'done' && !existing.doneAt ? Date.now() : existing.doneAt,
        }
        next.push(entry)
        usedSlots.push(entry.slot)
      } else {
        const slot = pickSlot(usedSlots)
        usedSlots.push(slot)
        next.push({
          exec, slot,
          id: exec.toolName + '-' + Date.now(),
          enteredAt: Date.now(),
          doneAt: exec.status === 'done' ? Date.now() : undefined,
        })
      }
    }

    entriesRef.current = next
    setEntries([...next])
  }, [executions])

  useEffect(() => {
    const doneEntries = entries.filter((e) => e.doneAt)
    if (doneEntries.length === 0) return
    const t = setTimeout(() => {
      const now = Date.now()
      entriesRef.current = entriesRef.current.filter(
        (e) => !e.doneAt || now - e.doneAt < DISMISS_MS,
      )
      setEntries([...entriesRef.current])
    }, DISMISS_MS)
    return () => clearTimeout(t)
  }, [entries])

  const [dragging, setDragging] = useState(false)
  const [overTrash, setOverTrash] = useState(false)
  const draggingIdRef = useRef<string | null>(null)

  const dismissEntry = (id: string) => {
    entriesRef.current = entriesRef.current.filter((e) => e.id !== id)
    setEntries([...entriesRef.current])
  }

  if (entries.length === 0) return null

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 'calc(50% - 65px)',
        left: '50%',
        width: 0, height: 0,
        zIndex: 20,
        pointerEvents: 'none',
      }}>
        <AnimatePresence>
          {entries.map((entry, i) => (
            <HUDPanel key={entry.id} entry={entry} index={i}
              onDismiss={() => dismissEntry(entry.id)}
              onDragStart={() => { setDragging(true); draggingIdRef.current = entry.id }}
              onDragEnd={() => {
                // Checar posição do mouse via último evento
                if (overTrash && draggingIdRef.current) {
                  dismissEntry(draggingIdRef.current)
                }
                setDragging(false)
                draggingIdRef.current = null
                setOverTrash(false)
              }}
              onDrag={(e) => {
                const evt = e as unknown as PointerEvent
                if (evt.clientY) setOverTrash(evt.clientY > window.innerHeight - 120)
              }}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Lixeira — aparece quando arrasta */}
      <AnimatePresence>
        {dragging ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 25,
              pointerEvents: 'none',
            }}
          >
            <div style={{
              width: 56, height: 56,
              borderRadius: '50%',
              background: overTrash ? 'rgba(255, 107, 107, .3)' : 'rgba(255, 255, 255, .08)',
              border: `2px solid ${overTrash ? 'var(--st-error)' : 'rgba(255, 255, 255, .15)'}`,
              display: 'grid', placeItems: 'center',
              transition: 'all .15s',
              transform: overTrash ? 'scale(1.15)' : 'none',
            }}>
              <span style={{ fontSize: 22, filter: overTrash ? 'none' : 'grayscale(1) opacity(.5)' }}>🗑</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

// -- Painel individual ---------------------------------------------

function HUDPanel({ entry, index, onDismiss, onDragStart, onDragEnd, onDrag }: {
  entry: HUDEntry; index: number; onDismiss: () => void
  onDragStart?: () => void
  onDragEnd?: (event: any, info: any) => void
  onDrag?: (event: any, info: any) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const exec = entry.exec
  const isExecuting = exec.status === 'executing'
  const isError = exec.status === 'done' && !exec.result?.success
  const isDone = exec.status === 'done'
  const label = TOOL_LABELS[exec.toolName] ?? exec.toolName
  const { x, y } = polarToXY(entry.slot)
  const slideX = entry.slot.side === 'left' ? -30 : 30

  const hasDetails = isDone && (exec.args || exec.result?.message)

  const argLines = useMemo(() => {
    if (!exec.args) return []
    return Object.entries(exec.args)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .slice(0, 4)
      .map(([k, v]) => {
        const val = typeof v === 'string' ? v : JSON.stringify(v)
        return `${k}: ${val.length > 32 ? val.slice(0, 29) + '...' : val}`
      })
  }, [exec.args])

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.1}
      onDragStart={() => onDragStart?.()}
      onDrag={(e, info) => onDrag?.(e, info)}
      onDragEnd={(e, info) => onDragEnd?.(e, info)}
      whileDrag={{ scale: 1.05, zIndex: 50 }}
      layout
      initial={{ opacity: 0, x: x + slideX, y, scale: 0.88 }}
      animate={{ opacity: 1, x, y, scale: 1 }}
      exit={{ opacity: 0, x: x + slideX * 0.5, y, scale: 0.92 }}
      transition={{
        layout: spring.morph,
        x: spring.morph, y: spring.morph, scale: spring.morph,
        opacity: { duration: dur.slow, delay: index * stagger * 3 },
      }}
      style={{
        position: 'absolute',
        transform: 'translate(-50%, -50%)',
        maxWidth: expanded ? 320 : 260, minWidth: 180,
        pointerEvents: 'auto',
        cursor: 'grab',
      }}
    >
      <Brackets color={isError ? 'var(--st-error)' : 'var(--accent)'} />
      <div className="glass" style={{
        borderRadius: 'var(--r-sm)',
        padding: '10px 13px',
        fontSize: 11,
        fontFamily: 'var(--f-mono)',
        display: 'flex', flexDirection: 'column', gap: 7,
      }}>
        {/* Header — clicável pra expandir */}
        <div
          onClick={(e) => { e.stopPropagation(); if (hasDetails) setExpanded((v) => !v) }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
            cursor: hasDetails ? 'pointer' : 'default', userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: isError ? 'var(--st-error)' : isExecuting ? 'var(--accent)' : 'var(--st-executing)',
              boxShadow: `0 0 8px ${isError ? 'var(--st-error)' : 'rgba(var(--accent-rgb), .5)'}`,
              animation: isExecuting ? 'pulse 1.2s infinite' : 'none',
            }} />
            <span style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: '.04em',
              textTransform: 'uppercase', color: 'var(--t-hi)',
            }}>
              {label}
            </span>
          </div>
          <span style={{
            fontSize: 9.5, color: isError ? 'var(--st-error)' : 'var(--t-ghost)',
            letterSpacing: '.03em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {isExecuting ? 'exec' : isError ? 'fail' : 'done'}
            {hasDetails ? (
              <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.15 }} style={{ fontSize: 7, lineHeight: 1 }}>▼</motion.span>
            ) : null}
            <span
              onClick={(e) => { e.stopPropagation(); onDismiss() }}
              style={{
                width: 16, height: 16, borderRadius: '50%',
                display: 'grid', placeItems: 'center',
                fontSize: 10, color: 'var(--t-ghost)', cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--t-mid)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t-ghost)')}
            >✕</span>
          </span>
        </div>

        {/* Progress */}
        {isExecuting ? (
          <div style={{ height: 2, borderRadius: 1, background: 'var(--fill-1)', overflow: 'hidden' }}>
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: '200%' }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: '40%', height: '100%', borderRadius: 1,
                background: 'var(--accent)',
                boxShadow: '0 0 8px rgba(var(--accent-rgb), .4)',
              }}
            />
          </div>
        ) : (
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: dur.base }}
            style={{
              height: 2, borderRadius: 1, transformOrigin: 'left', opacity: 0.5,
              background: isError ? 'var(--st-error)' : 'var(--st-executing)',
            }}
          />
        )}

        {/* Expanded details */}
        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ height: spring.morph, opacity: { duration: dur.base } }}
              style={{ overflow: 'hidden' }}
            >
              {/* Args */}
              {argLines.length > 0 ? (
                <div style={{
                  borderTop: '1px solid var(--hair)', paddingTop: 6,
                  display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 5,
                }}>
                  {argLines.map((line, i) => (
                    <span key={i} style={{ fontSize: 9.5, color: 'var(--t-low)', lineHeight: 1.4 }}>{line}</span>
                  ))}
                </div>
              ) : null}

              {/* Result — formatado */}
              {exec.result?.message ? (
                <div style={{
                  borderTop: argLines.length ? undefined : '1px solid var(--hair)',
                  paddingTop: argLines.length ? 0 : 6,
                  fontSize: 9.5, lineHeight: 1.45,
                  color: isError ? 'var(--st-error)' : 'var(--t-low)',
                  maxHeight: 120, overflowY: 'auto',
                  wordBreak: 'break-word',
                  maskImage: 'linear-gradient(#000 calc(100% - 12px), transparent)',
                }}>
                  <FormattedResult message={exec.result.message} />
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Elapsed */}
        <ElapsedTimer startedAt={entry.enteredAt} running={isExecuting} />
      </div>
    </motion.div>
  )
}

// -- Resultado formatado (sem JSON cru) ----------------------------

function FormattedResult({ message }: { message: string }) {
  // Tentar parsear JSON e mostrar key-value
  try {
    const data = JSON.parse(message)
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const entries = Object.entries(data).filter(([k]) => !k.startsWith('_'))
      return (
        <>
          {entries.slice(0, 6).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
              <span style={{ color: 'var(--t-ghost)' }}>{k.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span style={{ color: 'var(--t-low)', textAlign: 'right' }}>
                {typeof v === 'number' && v % 1 !== 0 ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : String(v).slice(0, 30)}
              </span>
            </div>
          ))}
          {entries.length > 6 ? <div style={{ color: 'var(--t-ghost)', marginTop: 2 }}>+{entries.length - 6} campos</div> : null}
        </>
      )
    }
    if (Array.isArray(data)) {
      return <span>{data.length} resultados</span>
    }
  } catch { /* não é JSON */ }

  // Texto normal: mostrar truncado
  return <span>{message.slice(0, 150)}</span>
}

// -- Corner brackets -----------------------------------------------

function Brackets({ color }: { color: string }) {
  const base: React.CSSProperties = {
    position: 'absolute', width: 10, height: 10,
    borderColor: color, borderStyle: 'solid', borderWidth: 0,
    opacity: 0.4, transition: 'border-color .7s',
  }
  return (
    <>
      <span style={{ ...base, top: -3, left: -3, borderTopWidth: 1, borderLeftWidth: 1 }} />
      <span style={{ ...base, top: -3, right: -3, borderTopWidth: 1, borderRightWidth: 1 }} />
      <span style={{ ...base, bottom: -3, left: -3, borderBottomWidth: 1, borderLeftWidth: 1 }} />
      <span style={{ ...base, bottom: -3, right: -3, borderBottomWidth: 1, borderRightWidth: 1 }} />
    </>
  )
}

// -- Elapsed timer -------------------------------------------------

function ElapsedTimer({ startedAt, running }: { startedAt: number; running: boolean }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 100) / 10), 100)
    return () => clearInterval(id)
  }, [startedAt, running])
  if (!running && elapsed === 0) return null
  return (
    <div style={{
      fontSize: 9.5, fontFamily: 'var(--f-mono)', color: 'var(--t-ghost)',
      fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em', textAlign: 'right',
    }}>
      {elapsed.toFixed(1)}s
    </div>
  )
}
