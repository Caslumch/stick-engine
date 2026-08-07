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
        width: 320,
        maxHeight: 'min(55vh, 440px)',
        zIndex: 12,
        pointerEvents: 'auto',
        cursor: 'grab',
      }}
    >
      <div className="glass" style={{
        borderRadius: 'var(--r-sm)',
        padding: 0,
        overflow: 'hidden',
        background: 'rgba(10, 10, 10, .65)',
        backdropFilter: 'blur(24px) saturate(150%)',
      }}>
        {/* Title bar estilo Linux */}
        <div style={{
          padding: '8px 14px',
          borderBottom: '1px solid rgba(255, 255, 255, .08)',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255, 255, 255, .04)',
        }}>
          {/* Dots estilo macOS/Linux */}
          <div style={{ display: 'flex', gap: 5 }}>
            <span
              onClick={(e) => { e.stopPropagation(); setLog([]); seenToolsRef.current.clear() }}
              style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57', cursor: 'pointer' }}
            />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FEBC2E' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840' }} />
          </div>
          <span style={{
            fontSize: 11, fontFamily: 'var(--f-mono)', fontWeight: 500,
            color: 'var(--t-low)', marginLeft: 6,
          }}>
            jarvis@local:~$
          </span>
        </div>

        {/* Log */}
        <div
          ref={scrollRef}
          style={{
            overflowY: 'auto',
            maxHeight: 'min(48vh, 380px)',
            padding: '10px 14px',
            maskImage: 'linear-gradient(transparent, #000 6px, #000 calc(100% - 12px), transparent)',
          }}
        >
          <AnimatePresence initial={false}>
            {log.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: dur.base }}
                style={{
                  fontFamily: 'var(--f-mono)',
                  fontSize: 11,
                  lineHeight: 1.55,
                  marginBottom: 10,
                }}
              >
                {/* Prompt line */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ color: '#28C840', fontSize: 10.5 }}>$</span>
                  <span style={{
                    color: entry.status === 'done'
                      ? entry.success ? '#28C840' : 'var(--st-error)'
                      : 'var(--accent)',
                    fontWeight: 500, fontSize: 11,
                  }}>
                    {entry.label}
                  </span>
                  <span style={{ color: 'var(--t-ghost)', fontSize: 9.5, fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>
                    {entry.time}
                  </span>
                </div>

                {/* Args como flags */}
                {entry.args.map((arg, i) => (
                  <div key={i} style={{ color: 'var(--t-low)', fontSize: 10.5, paddingLeft: 16, marginTop: 1 }}>
                    --{arg}
                  </div>
                ))}

                {/* Resultado */}
                {entry.status === 'done' && (
                  <div style={{ fontSize: 10.5, color: entry.success ? '#28C840' : 'var(--st-error)', marginTop: 3, paddingLeft: 16 }}>
                    {entry.success ? '✓ done' : `✗ ${entry.error || 'failed'}`}
                  </div>
                )}

                {/* Loading */}
                {entry.status === 'executing' && (
                  <div style={{
                    marginTop: 4, height: 2, borderRadius: 1,
                    background: 'rgba(255,255,255,.06)', overflow: 'hidden', width: '80%',
                    marginLeft: 16,
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
