import type { ToolExecution } from '../stores/jarvis.store'

/**
 * Card de ferramenta — vidro 14px, ponto lima, nome mono, latência.
 * Seção 10 do DESIGN_SYSTEM.md.
 */
export function ToolCard({ exec }: { exec: ToolExecution }) {
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
        borderBottom: '1px solid var(--hair)',
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: exec.status === 'done'
            ? (exec.result?.success ? 'var(--st-executing)' : 'var(--st-error)')
            : 'var(--st-executing)',
          boxShadow: `0 0 8px ${exec.status === 'done' && !exec.result?.success ? 'var(--st-error)' : 'var(--st-executing)'}`,
        }} />
        <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12.5, color: 'var(--t-hi)' }}>
          {exec.toolName}
        </span>
        {exec.result?.message && (
          <span style={{ marginLeft: 'auto', color: 'var(--t-low)', fontSize: 12 }}>
            {exec.result.message}
          </span>
        )}
      </div>
      {exec.args && (
        <div style={{
          padding: '12px 15px',
          fontFamily: 'var(--f-mono)',
          fontSize: 12,
          lineHeight: 1.75,
          color: 'var(--t-low)',
          whiteSpace: 'pre-wrap',
        }}>
          {JSON.stringify(exec.args, null, 2)}
        </div>
      )}
    </div>
  )
}
