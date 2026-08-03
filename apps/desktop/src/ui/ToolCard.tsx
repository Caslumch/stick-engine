import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { spring, dur } from '../motion/tokens'
import { TOOL_LABELS } from '../app/strings'
import type { ToolExecution } from '../stores/jarvis.store'

/**
 * Card de ferramenta expandível — vidro 14px, ponto de status, resultado.
 * Clica pra expandir e ver resultado/dados/erro.
 */
export function ToolCard({ exec }: { exec: ToolExecution }) {
  const [expanded, setExpanded] = useState(false)

  const label = TOOL_LABELS[exec.toolName] ?? exec.toolName
  const isExecuting = exec.status === 'executing'
  const isSuccess = exec.status === 'done' && exec.result?.success
  const isError = exec.status === 'done' && !exec.result?.success
  const hasDetails = exec.status === 'done' && (exec.result?.message || exec.result?.data)

  return (
    <motion.div
      layout
      transition={spring.morph}
      className="glass"
      onClick={() => hasDetails && setExpanded((v) => !v)}
      style={{
        borderRadius: 'var(--r-sm)',
        overflow: 'hidden',
        maxWidth: '88%',
        marginLeft: 38,
        fontSize: 13,
        cursor: hasDetails ? 'pointer' : 'default',
      }}
    >
      {/* Header */}
      <motion.div
        layout="position"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '11px 15px',
          color: 'var(--t-mid)',
        }}
      >
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          flexShrink: 0,
          background: isError ? 'var(--st-error)' : 'var(--st-executing)',
          boxShadow: `0 0 8px ${isError ? 'var(--st-error)' : 'var(--st-executing)'}`,
          animation: isExecuting ? 'pulse 1.2s infinite' : 'none',
        }} />
        <span style={{ fontSize: 13, color: 'var(--t-hi)', fontWeight: 450 }}>
          {label}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--t-low)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {isExecuting && 'em andamento...'}
          {isSuccess && 'concluído'}
          {isError && 'erro'}
          {hasDetails ? (
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: dur.fast }}
              style={{ display: 'inline-block', fontSize: 10, lineHeight: 1 }}
            >
              ▼
            </motion.span>
          ) : null}
        </span>
      </motion.div>

      {/* Expanded details */}
      <AnimatePresence initial={false}>
        {expanded && hasDetails ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: spring.morph,
              opacity: { duration: dur.base },
            }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 15px 13px',
              borderTop: '1px solid var(--hair)',
              paddingTop: 11,
            }}>
              {/* Mensagem */}
              {exec.result?.message && (
                <p style={{
                  margin: 0,
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: isError ? 'var(--st-error)' : 'var(--t-mid)',
                  wordBreak: 'break-word',
                }}>
                  {exec.result.message}
                </p>
              )}

              {/* Dados da tool */}
              {exec.result?.data != null && (
                <pre style={{
                  margin: exec.result?.message ? '8px 0 0' : 0,
                  padding: '9px 12px',
                  borderRadius: 'var(--r-xs)',
                  background: 'var(--fill-1)',
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  fontFamily: 'var(--f-mono)',
                  color: 'var(--t-low)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 240,
                  overflowY: 'auto',
                  maskImage: 'linear-gradient(#000 calc(100% - 30px), transparent)',
                }}>
                  {typeof exec.result.data === 'string'
                    ? exec.result.data
                    : JSON.stringify(exec.result.data, null, 2)}
                </pre>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
