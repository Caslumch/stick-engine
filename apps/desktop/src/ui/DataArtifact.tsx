import { useEffect, useMemo, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { spring, dur } from '../motion/tokens'
import { TOOL_LABELS } from '../app/strings'
import { useJarvisStore } from '../stores/jarvis.store'
import { Markdown } from './Markdown'

/* ----------------------------------------------------------------
   DataArtifact — card expandível de dados estruturados.
   Header clicável pra expand, card inteiro arrastável.
   ---------------------------------------------------------------- */

interface DataRow {
  label: string
  value: string
}

const AUTO_DISMISS_MS = 22000
const POST_CLOSE_DISMISS_MS = 8000
const COMPACT_ROWS = 3

function unwrapMcpData(data: unknown): unknown {
  if (Array.isArray(data) && data.length > 0 && data[0]?.type === 'text' && data[0]?.text) {
    try { return JSON.parse(data[0].text as string) } catch { return data[0].text }
  }
  return data
}

function extractRows(rawData: unknown, rawMessage?: string): DataRow[] {
  let data = rawData ? unwrapMcpData(rawData) : null
  if (!data && rawMessage) {
    try { data = JSON.parse(rawMessage) } catch { /* */ }
  }
  if (!data) return []
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { return [] }
  }

  // Desembrulhar envelope { data: [...], meta: {...} } — padrão de API paginada
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.data) && obj.data.length > 0) {
      data = obj.data
    }
  }

  if (Array.isArray(data)) {
    return data.slice(0, 20).map((item, i) => parseItem(item, i))
  }

  if (typeof data === 'object' && data !== null) {
    return Object.entries(data as Record<string, unknown>)
      .filter(([k]) => !k.startsWith('_'))
      .slice(0, 15)
      .map(([k, v]) => ({ label: fmtLabel(k), value: fmtValue(v) }))
  }
  return []
}

/** Extrai string legível de um campo que pode ser string, object com name/label, ou outro */
function readable(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object' && val !== null) {
    const o = val as Record<string, unknown>
    return String(o.name || o.label || o.title || o.id || '')
  }
  return String(val)
}

function parseItem(item: unknown, i: number): DataRow {
  if (typeof item === 'string') return { label: `${i + 1}`, value: item.slice(0, 60) }
  if (typeof item !== 'object' || item === null) return { label: `${i + 1}`, value: String(item) }
  const o = item as Record<string, unknown>

  // Transações financeiras
  if (o.description && o.amount !== undefined) {
    const cat = o.category ? ` (${readable(o.category).slice(0, 15)})` : ''
    return { label: String(o.description).slice(0, 28) + cat, value: fmtCurrency(o.amount) }
  }
  if (o.title) {
    const extra = o.amount !== undefined ? ` — ${fmtCurrency(o.amount)}` : ''
    return { label: readable(o.category || o.type || o.date || `${i + 1}`).slice(0, 20), value: String(o.title).slice(0, 38) + extra }
  }
  if (o.name) return { label: readable(o.type || o.category || `${i + 1}`).slice(0, 20), value: String(o.name).slice(0, 50) }

  // Genérico: primeiros campos que são primitivos
  const entries = Object.entries(o).filter(([k, v]) => !k.startsWith('_') && typeof v !== 'object')
  if (entries.length >= 2) return { label: String(entries[0][1]).slice(0, 22), value: String(entries[1][1]).slice(0, 42) }
  if (entries.length === 1) return { label: String(entries[0][0]), value: String(entries[0][1]).slice(0, 50) }
  return { label: `${i + 1}`, value: JSON.stringify(item).slice(0, 55) }
}

function fmtLabel(key: string): string {
  // Traduzir campos comuns
  const map: Record<string, string> = {
    period: 'Período', income: 'Receita', totalSpent: 'Total gasto',
    expenseOnCard: 'Cartão', expenseOutOfCard: 'Fora do cartão',
    cardInvoice: 'Fatura', invoicePayment: 'Pgto fatura',
    balance: 'Saldo', incomeCount: 'Qtd receitas', expenseCount: 'Qtd despesas',
    totalExpenses: 'Total despesas', total: 'Total', date: 'Data',
    category: 'Categoria', description: 'Descrição', amount: 'Valor',
    name: 'Nome', type: 'Tipo', status: 'Status', count: 'Quantidade',
  }
  return map[key] || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()).trim()
}

function fmtCurrency(val: unknown): string {
  const n = Number(val); if (isNaN(n)) return String(val)
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function fmtValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'number') {
    if (val !== 0 && Math.abs(val) < 1e6 && val % 1 !== 0) return fmtCurrency(val)
    return val.toLocaleString('pt-BR')
  }
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não'
  if (typeof val === 'string') return val.slice(0, 50)
  // Objetos/arrays: não mostrar JSON, mostrar resumo
  if (Array.isArray(val)) return `${val.length} itens`
  if (typeof val === 'object') return Object.keys(val as object).slice(0, 3).join(', ')
  return String(val).slice(0, 50)
}

// -- Componente ----------------------------------------------------

export function DataArtifact() {
  const lastRich = useJarvisStore((s) => s.lastRichResult)
  const clearLastRichResult = useJarvisStore((s) => s.clearLastRichResult)
  const productImages = useJarvisStore((s) => s.productImages)

  const [expanded, setExpanded] = useState(false)
  const [wasInteracted, setWasInteracted] = useState(false)
  const lastKeyRef = useRef('')

  const rows = useMemo(() => {
    if (!lastRich) return []
    return extractRows(lastRich.result?.data, lastRich.result?.message)
  }, [lastRich])

  const label = lastRich ? (TOOL_LABELS[lastRich.toolName] ?? lastRich.toolName) : ''

  useEffect(() => {
    if (!lastRich) return
    const key = lastRich.toolName + lastRich.capturedAt
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key
      setExpanded(false)
      setWasInteracted(false)
    }
  }, [lastRich])

  useEffect(() => {
    if (!lastRich || rows.length === 0) return
    if (expanded) return
    const delay = wasInteracted ? POST_CLOSE_DISMISS_MS : AUTO_DISMISS_MS
    const t = setTimeout(clearLastRichResult, delay)
    return () => clearTimeout(t)
  }, [lastRich, rows.length, expanded, wasInteracted, clearLastRichResult])

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setWasInteracted(true)
    setExpanded((v) => !v)
  }

  // Texto puro: message longa sem dados estruturados (ex: resposta da LLM)
  const isTextContent = lastRich && rows.length === 0 && (lastRich.result?.message?.length ?? 0) > 100
  const textContent = isTextContent ? lastRich.result?.message ?? '' : ''

  const visible = lastRich && (rows.length > 0 || isTextContent)
  const displayRows = expanded ? rows : rows.slice(0, COMPACT_ROWS)
  const hasMore = rows.length > COMPACT_ROWS

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key={lastRich.capturedAt}
          drag
          dragMomentum={false}
          dragElastic={0}
          layout
          initial={{ opacity: 0, x: 30, scale: 0.92 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.95 }}
          transition={{ layout: spring.morph, scale: spring.morph, x: spring.morph, opacity: { duration: dur.slow } }}
          style={{
            position: 'fixed',
            right: 28,
            top: '50%',
            width: expanded ? 400 : 340,
            maxHeight: expanded ? 'min(80vh, 600px)' : 'min(40vh, 280px)',
            zIndex: 16,
            pointerEvents: 'auto',
            cursor: 'grab',
          }}
        >
          <div className="glass" style={{ borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
            {/* Header — clicável pra expand */}
            <div
              onClick={toggleExpand}
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--hair)',
                display: 'flex', alignItems: 'center', gap: 7,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--st-executing)',
                boxShadow: '0 0 8px var(--st-executing)',
              }} />
              <span style={{
                fontSize: 10.5, fontFamily: 'var(--f-mono)', fontWeight: 600,
                letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--t-hi)',
              }}>
                {label}
              </span>
              <span style={{
                fontSize: 9.5, color: 'var(--t-ghost)', marginLeft: 'auto',
                fontFamily: 'var(--f-mono)', letterSpacing: '.03em',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {isTextContent ? 'detalhes' : `${rows.length} itens`}
                {hasMore ? (
                  <motion.span
                    animate={{ rotate: expanded ? 180 : 0 }}
                    transition={{ duration: 0.15 }}
                    style={{ fontSize: 8, lineHeight: 1 }}
                  >▼</motion.span>
                ) : null}
                {/* Botão fechar */}
                <span
                  onClick={(e) => { e.stopPropagation(); clearLastRichResult() }}
                  style={{
                    width: 18, height: 18, borderRadius: '50%',
                    display: 'grid', placeItems: 'center',
                    fontSize: 11, color: 'var(--t-ghost)',
                    cursor: 'pointer', marginLeft: 2,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--t-mid)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t-ghost)')}
                >
                  ✕
                </span>
              </span>
            </div>

            {/* Conteúdo: texto ou rows */}
            <motion.div layout style={{
              padding: isTextContent ? '12px 16px' : '4px 0',
              maxHeight: expanded ? 'min(70vh, 520px)' : isTextContent ? 110 : 'auto',
              overflowY: expanded ? 'auto' : 'hidden',
              maskImage: !expanded ? 'linear-gradient(#000 70%, transparent)' : 'linear-gradient(#000 calc(100% - 16px), transparent)',
            }}>
              {/* Texto puro (resposta longa) */}
              {isTextContent ? (
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--t-mid)' }}>
                  <Markdown content={textContent} />
                </div>
              ) : null}

              {/* Dados estruturados */}
              <AnimatePresence initial={false}>
                {displayRows.map((row, i) => (
                  <motion.div
                    key={`${lastRich.capturedAt}-${i}`}
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: dur.base, delay: i * 0.05 }}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      gap: 10, padding: '5px 14px',
                      borderBottom: '1px solid rgba(255,255,255,.03)',
                    }}
                  >
                    <span style={{
                      fontSize: 11, color: 'var(--t-low)', fontFamily: 'var(--f)',
                      fontWeight: 400, overflow: 'hidden',
                      textOverflow: 'ellipsis', maxWidth: '45%', minWidth: 0,
                    }}>
                      {row.label}
                    </span>
                    <span style={{
                      fontSize: 11.5, color: 'var(--t-mid)', fontFamily: 'var(--f-mono)',
                      fontWeight: 450, textAlign: 'right',
                      overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '53%', minWidth: 0,
                    }}>
                      {row.value}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Imagens de produtos */}
              {productImages.length > 0 && (expanded || !isTextContent) ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: productImages.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 8,
                  padding: '8px 14px',
                  borderTop: '1px solid var(--hair)',
                }}>
                  {productImages.map((img, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: dur.base, delay: i * 0.1 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                    >
                      <img
                        src={img.thumbnail || img.image}
                        alt={img.title}
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: 90,
                          objectFit: 'cover',
                          borderRadius: 'var(--r-xs)',
                          background: 'var(--fill-1)',
                        }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <span style={{
                        fontSize: 9.5,
                        color: 'var(--t-low)',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {img.title}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : null}

              {!expanded && (hasMore || isTextContent) ? (
                <div
                  onClick={toggleExpand}
                  style={{
                    padding: '6px 14px 8px', cursor: 'pointer',
                    fontSize: 10, color: 'var(--accent)',
                    fontFamily: 'var(--f-mono)', letterSpacing: '.02em',
                    textAlign: 'center', userSelect: 'none',
                  }}
                >
                  {hasMore ? `+ ${rows.length - COMPACT_ROWS} itens · ` : ''}expandir
                </div>
              ) : null}
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
