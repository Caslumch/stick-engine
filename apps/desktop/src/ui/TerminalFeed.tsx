import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { spring, dur } from '../motion/tokens'
import { TOOL_LABELS } from '../app/strings'
import type { ToolExecution } from '../stores/jarvis.store'

/* ----------------------------------------------------------------
   TerminalFeed — terminal estilo Linux com glassmorphism.
   Botões funcionais: fechar (vermelho), minimizar (amarelo),
   maximizar (verde). Arrastável.
   ---------------------------------------------------------------- */

function formatTime(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatArgs(args?: Record<string, unknown>): string[] {
  if (!args || Object.keys(args).length === 0) return []
  return Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .slice(0, 4)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? v : JSON.stringify(v)
      return `${k}: ${val.length > 50 ? val.slice(0, 47) + '...' : val}`
    })
}

interface LogEntry {
  id: string
  time: string
  label: string
  args: string[]
  status: 'executing' | 'done'
  success?: boolean
  error?: string
}

type TermSize = 'normal' | 'minimized' | 'maximized'

const DISMISS_MS = 120000

const SIZE_CONFIG: Record<TermSize, { width: number | string; maxHeight: string }> = {
  minimized: { width: 280, maxHeight: '0px' },
  normal: { width: 400, maxHeight: 'min(50vh, 420px)' },
  maximized: { width: 560, maxHeight: 'min(75vh, 620px)' },
}

export function TerminalFeed({ executions }: { executions: ToolExecution[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [size, setSize] = useState<TermSize>('normal')
  const seenToolsRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    if (executions.length === 0) return
    setLog((prev) => {
      const next = [...prev]
      for (const exec of executions) {
        const existingId = seenToolsRef.current.get(exec.toolName)
        if (existingId) {
          const idx = next.findIndex((e) => e.id === existingId)
          if (idx >= 0 && exec.status === 'done' && next[idx].status !== 'done') {
            next[idx] = {
              ...next[idx], status: 'done',
              success: exec.result?.success,
              error: exec.result?.success ? undefined : exec.result?.message?.slice(0, 60),
            }
          }
        } else {
          const id = exec.toolName + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
          seenToolsRef.current.set(exec.toolName, id)
          next.push({
            id, time: formatTime(),
            label: TOOL_LABELS[exec.toolName] ?? exec.toolName,
            args: formatArgs(exec.args),
            status: exec.status,
            success: exec.result?.success,
            error: exec.result?.success ? undefined : exec.result?.message?.slice(0, 60),
          })
        }
      }
      return next
    })
  }, [executions])

  useEffect(() => {
    if (executions.length === 0 && log.length > 0) {
      const t = setTimeout(() => { setLog([]); seenToolsRef.current.clear() }, DISMISS_MS)
      return () => clearTimeout(t)
    }
  }, [executions.length, log.length])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [log])

  if (log.length === 0) return null

  const cfg = SIZE_CONFIG[size]
  const isMin = size === 'minimized'

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ layout: spring.morph, opacity: { duration: dur.slow } }}
      style={{
        position: 'fixed',
        left: 22,
        bottom: 120,
        width: cfg.width,
        zIndex: 12,
        pointerEvents: 'auto',
        cursor: 'grab',
      }}
    >
      <div style={{
        borderRadius: 'var(--r-sm)',
        overflow: 'hidden',
        background: 'rgba(10, 10, 10, .72)',
        backdropFilter: 'blur(28px) saturate(140%)',
        border: '1px solid rgba(255, 255, 255, .08)',
        boxShadow: '0 12px 40px -10px rgba(0, 0, 0, .5)',
      }}>
        {/* Title bar */}
        <div style={{
          padding: '9px 14px',
          borderBottom: isMin ? 'none' : '1px solid rgba(255, 255, 255, .08)',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255, 255, 255, .03)',
          userSelect: 'none',
        }}>
          {/* Dots funcionais */}
          <div style={{ display: 'flex', gap: 6 }}>
            {/* Fechar */}
            <span
              onClick={(e) => { e.stopPropagation(); setLog([]); seenToolsRef.current.clear() }}
              style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57', cursor: 'pointer', transition: 'filter .15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
              title="Fechar"
            />
            {/* Minimizar */}
            <span
              onClick={(e) => { e.stopPropagation(); setSize(size === 'minimized' ? 'normal' : 'minimized') }}
              style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E', cursor: 'pointer', transition: 'filter .15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
              title="Minimizar"
            />
            {/* Maximizar */}
            <span
              onClick={(e) => { e.stopPropagation(); setSize(size === 'maximized' ? 'normal' : 'maximized') }}
              style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840', cursor: 'pointer', transition: 'filter .15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
              title="Maximizar"
            />
          </div>

          <span style={{
            fontSize: 12, fontFamily: 'var(--f-mono)', fontWeight: 500,
            color: 'var(--t-low)', marginLeft: 8,
          }}>
            jarvis@local:~$
          </span>

          <span style={{
            fontSize: 10, fontFamily: 'var(--f-mono)',
            color: 'var(--t-ghost)', marginLeft: 'auto',
          }}>
            {log.length} cmd{log.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Log area */}
        <AnimatePresence initial={false}>
          {!isMin ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ height: spring.morph, opacity: { duration: dur.base } }}
            >
              <div
                ref={scrollRef}
                style={{
                  overflowY: 'auto',
                  maxHeight: cfg.maxHeight,
                  padding: '12px 16px',
                  maskImage: 'linear-gradient(transparent, #000 8px, #000 calc(100% - 14px), transparent)',
                }}
              >
                {log.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: dur.base }}
                    style={{
                      fontFamily: 'var(--f-mono)',
                      fontSize: size === 'maximized' ? 12.5 : 11.5,
                      lineHeight: 1.55,
                      marginBottom: 12,
                    }}
                  >
                    {/* Prompt */}
                    <div style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
                      <span style={{ color: '#28C840', fontSize: size === 'maximized' ? 12 : 11 }}>$</span>
                      <span style={{
                        color: entry.status === 'done'
                          ? entry.success ? '#28C840' : 'var(--st-error)'
                          : 'var(--accent)',
                        fontWeight: 500,
                      }}>
                        {entry.label}
                      </span>
                      <span style={{
                        color: 'var(--t-ghost)', fontSize: 10,
                        fontVariantNumeric: 'tabular-nums', marginLeft: 'auto',
                      }}>
                        {entry.time}
                      </span>
                    </div>

                    {/* Args */}
                    {entry.args.map((arg, i) => (
                      <div key={i} style={{
                        color: 'var(--t-low)', fontSize: size === 'maximized' ? 11.5 : 10.5,
                        paddingLeft: 18, marginTop: 2,
                      }}>
                        --{arg}
                      </div>
                    ))}

                    {/* Result */}
                    {entry.status === 'done' && (
                      <div style={{
                        fontSize: size === 'maximized' ? 11.5 : 10.5,
                        color: entry.success ? '#28C840' : 'var(--st-error)',
                        marginTop: 4, paddingLeft: 18,
                      }}>
                        {entry.success ? '✓ done' : `✗ ${entry.error || 'failed'}`}
                      </div>
                    )}

                    {/* Loading */}
                    {entry.status === 'executing' && (
                      <div style={{
                        marginTop: 5, height: 2, borderRadius: 1,
                        background: 'rgba(255,255,255,.06)', overflow: 'hidden',
                        width: '85%', marginLeft: 18,
                      }}>
                        <motion.div
                          initial={{ x: '-100%' }} animate={{ x: '200%' }}
                          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                          style={{ width: '35%', height: '100%', background: 'var(--accent)', opacity: 0.5 }}
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
