import type { ToolExecution } from '../stores/jarvis.store'
import { TOOL_LABELS } from '../app/strings'

/**
 * Card de ferramenta — vidro 14px, ponto lima, nome traduzido, status.
 * Seção 10 do DESIGN_SYSTEM.md.
 */
export function ToolCard({ exec }: { exec: ToolExecution }) {
  const label = TOOL_LABELS[exec.toolName] ?? exec.toolName
  const isExecuting = exec.status === 'executing'
  const isSuccess = exec.status === 'done' && exec.result?.success
  const isError = exec.status === 'done' && !exec.result?.success

  return (
    <div className="glass" style={{
      borderRadius: 'var(--r-sm)',
      overflow: 'hidden',
      maxWidth: '88%',
      marginLeft: 38,
      fontSize: 13,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 15px',
        color: 'var(--t-mid)',
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: isError ? 'var(--st-error)' : 'var(--st-executing)',
          boxShadow: `0 0 8px ${isError ? 'var(--st-error)' : 'var(--st-executing)'}`,
          animation: isExecuting ? 'pulse 1.2s infinite' : 'none',
        }} />
        <span style={{ fontSize: 13, color: 'var(--t-hi)', fontWeight: 450 }}>
          {label}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--t-low)' }}>
          {isExecuting && 'em andamento...'}
          {isSuccess && 'concluído'}
          {isError && 'erro'}
        </span>
      </div>
    </div>
  )
}
