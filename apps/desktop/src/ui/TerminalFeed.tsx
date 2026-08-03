import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { dur } from '../motion/tokens'
import { TOOL_LABELS } from '../app/strings'
import type { ToolExecution } from '../stores/jarvis.store'

/* ----------------------------------------------------------------
   TerminalFeed — painel sutil no lado esquerdo da tela de voz.
   Mostra o log de execuções em tempo real, estilo terminal.
   ---------------------------------------------------------------- */

function formatTime(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatArgs(args?: Record<string, unknown>): string[] {
  if (!args || Object.keys(args).length === 0) return []
  return Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .slice(0, 3)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? v : JSON.stringify(v)
      return `${k}: ${val.length > 36 ? val.slice(0, 33) + '...' : val}`
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

const DISMISS_MS = 120000 // 2 minutos

export function TerminalFeed({ executions }: { executions: ToolExecution[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const seenToolsRef = useRef<Map<string, string>>(new Map()) // toolName → entryId

  // Acumula entries quando executions mudam
  useEffect(() => {
    if (executions.length === 0) return

    setLog((prev) => {
      const next = [...prev]
      for (const exec of executions) {
        const existingId = seenToolsRef.current.get(exec.toolName)
        if (existingId) {
          // Atualizar status
          const idx = next.findIndex((e) => e.id === existingId)
          if (idx >= 0 && exec.status === 'done' && next[idx].status !== 'done') {
            next[idx] = {
              ...next[idx],
              status: 'done',
              success: exec.result?.success,
              error: exec.result?.success ? undefined : exec.result?.message?.slice(0, 50),
            }
          }
        } else {
          const id = exec.toolName + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
          seenToolsRef.current.set(exec.toolName, id)
          next.push({
            id,
            time: formatTime(),
            label: TOOL_LABELS[exec.toolName] ?? exec.toolName,
            args: formatArgs(exec.args),
            status: exec.status,
            success: exec.result?.success,
            error: exec.result?.success ? undefined : exec.result?.message?.slice(0, 50),
          })
        }
      }
      return next
    })
  }, [executions])

  // Limpar quando executions zera (nova conversa ou clear)
  useEffect(() => {
    if (executions.length === 0 && log.length > 0) {
      const t = setTimeout(() => {
        setLog([])
        seenToolsRef.current.clear()
      }, DISMISS_MS)
      return () => clearTimeout(t)
    }
  }, [executions.length, log.length])

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [log])

  if (log.length === 0) return null

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.05}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ opacity: { duration: dur.slow }, x: { duration: dur.base } }}
      style={{
        position: 'fixed',
        left: 22,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 250,
        maxHeight: 'min(46vh, 360px)',
        zIndex: 12,
        pointerEvents: 'auto',
        cursor: 'grab',
      }}
    >
      <div style={{
        background: 'rgba(0, 0, 0, .38)',
        borderRadius: 'var(--r-sm)',
        border: '1px solid rgba(255, 255, 255, .05)',
        padding: '10px 0',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '0 12px 7px',
          borderBottom: '1px solid rgba(255, 255, 255, .05)',
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 6,
        }}>
          <span style={{
            width: 4, height: 4, borderRadius: '50%',
            background: 'var(--accent)', opacity: 0.6,
          }} />
          <span style={{
            fontSize: 9.5, fontFamily: 'var(--f-mono)', fontWeight: 600,
            letterSpacing: '.06em', textTransform: 'uppercase',
            color: 'var(--t-ghost)',
          }}>
            execuções
          </span>
          <span
            onClick={(e) => {
              e.stopPropagation()
              setLog([])
              seenToolsRef.current.clear()
            }}
            style={{
              marginLeft: 'auto', width: 16, height: 16, borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              fontSize: 10, color: 'var(--t-ghost)', cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--t-mid)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t-ghost)')}
          >✕</span>
        </div>

        {/* Log */}
        <div
          ref={scrollRef}
          style={{
            overflowY: 'auto',
            maxHeight: 'min(40vh, 300px)',
            padding: '0 12px',
            maskImage: 'linear-gradient(transparent, #000 6px, #000 calc(100% - 12px), transparent)',
          }}
        >
          <AnimatePresence initial={false}>
            {log.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: dur.base }}
                style={{
                  fontFamily: 'var(--f-mono)',
                  fontSize: 9.5,
                  lineHeight: 1.5,
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--t-ghost)', fontSize: 8.5, fontVariantNumeric: 'tabular-nums' }}>
                    {entry.time}
                  </span>
                  <span style={{
                    color: entry.status === 'done'
                      ? entry.success ? 'var(--st-executing)' : 'var(--st-error)'
                      : 'var(--accent)',
                    fontWeight: 500, fontSize: 9.5,
                  }}>
                    {entry.label}
                  </span>
                </div>

                {entry.args.map((arg, i) => (
                  <div key={i} style={{ color: 'var(--t-ghost)', fontSize: 9, paddingLeft: 4, marginTop: 1 }}>
                    {arg}
                  </div>
                ))}

                {entry.status === 'done' && (
                  <div style={{ fontSize: 9, color: entry.success ? 'var(--t-low)' : 'var(--st-error)', marginTop: 2 }}>
                    {entry.success ? '→ ok' : `→ ${entry.error || 'falha'}`}
                  </div>
                )}

                {entry.status === 'executing' && (
                  <div style={{
                    marginTop: 3, height: 1.5, borderRadius: 1,
                    background: 'rgba(255,255,255,.05)', overflow: 'hidden', width: '70%',
                  }}>
                    <motion.div
                      initial={{ x: '-100%' }} animate={{ x: '200%' }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                      style={{ width: '35%', height: '100%', background: 'var(--accent)', opacity: 0.4 }}
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
