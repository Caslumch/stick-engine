import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { spring, dur } from '../motion/tokens'
import { useSocket } from '../hooks/useSocket'
import { API_URL } from '../app/endpoints'

/* ----------------------------------------------------------------
   RemindersPanel — mini painel flutuante + modal fullscreen.
   Ícone na MetaBar abre o mini. Botão expande pra fullscreen.
   ---------------------------------------------------------------- */

interface Reminder {
  id: string
  title: string
  description?: string
  dueAt: string
  completed: boolean
}

// -- Mini panel (flutuante) ----------------------------------------

export function RemindersPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')

  const socket = (useSocket as any)

  // Carregar lembretes via WebSocket
  const loadReminders = useCallback(() => {
    setLoading(true)
    // Usar a capability diretamente não é possível aqui,
    // então vamos buscar via fetch ao backend
    fetch(API_URL)
      .catch(() => {})
    // Temporariamente: usar socket pra enviar mensagem e capturar
    // Na verdade, vamos criar um endpoint REST simples
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!open) { setFullscreen(false); return }
    // Buscar lembretes do banco via API
    fetch(`${API_URL}/api/reminders`)
      .then((r) => r.json())
      .then((data) => setReminders(data))
      .catch(() => {
        // Fallback: tentar via WebSocket
        setReminders([])
      })
  }, [open])

  const createReminder = async () => {
    if (!newTitle.trim()) return
    const dueAt = newDate && newTime
      ? `${newDate}T${newTime}:00`
      : newDate
        ? `${newDate}T12:00:00`
        : new Date(Date.now() + 60 * 60000).toISOString() // +1h default

    try {
      const resp = await fetch(`${API_URL}/api/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, dueAt }),
      })
      if (resp.ok) {
        const reminder = await resp.json()
        setReminders((prev) => [reminder, ...prev])
        setNewTitle('')
        setNewDate('')
        setNewTime('')
        setShowCreate(false)
      }
    } catch { /* */ }
  }

  const completeReminder = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/reminders/${id}/complete`, { method: 'PATCH' })
      setReminders((prev) => prev.map((r) => r.id === id ? { ...r, completed: true } : r))
    } catch { /* */ }
  }

  const deleteReminder = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/reminders/${id}`, { method: 'DELETE' })
      setReminders((prev) => prev.filter((r) => r.id !== id))
    } catch { /* */ }
  }

  const pending = reminders.filter((r) => !r.completed)
  const completed = reminders.filter((r) => r.completed)

  if (!open) return null

  // Fullscreen modal
  if (fullscreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 40,
        }}
      >
        <motion.div
          initial={{ scale: 0.92, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={spring.morph}
          onClick={(e) => e.stopPropagation()}
          className="glass"
          style={{
            width: '100%', maxWidth: 600, maxHeight: '80vh',
            borderRadius: 'var(--r-lg)', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 24px', borderBottom: '1px solid var(--hair)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--t-hi)' }}>
              Lembretes
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowCreate(!showCreate)} style={btnStyle}>
                {showCreate ? '✕' : '+ Novo'}
              </button>
              <button onClick={() => setFullscreen(false)} style={btnStyle}>Minimizar</button>
              <button onClick={onClose} style={{ ...btnStyle, color: 'var(--t-ghost)' }}>✕</button>
            </div>
          </div>

          {/* Create form */}
          <AnimatePresence>
            {showCreate ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ height: spring.morph, opacity: { duration: dur.base } }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--hair)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="O que precisa lembrar?"
                    style={inputStyle}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && createReminder()}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                  </div>
                  <button onClick={createReminder} style={{ ...btnStyle, background: 'var(--accent)', color: '#000', fontWeight: 600, padding: '8px 20px', alignSelf: 'flex-end' }}>
                    Criar lembrete
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {pending.length === 0 && completed.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--t-ghost)', padding: 40, fontSize: 14 }}>
                Nenhum lembrete. Crie um novo ou peça por voz.
              </p>
            )}

            {pending.map((r) => (
              <ReminderRow key={r.id} reminder={r} onComplete={completeReminder} onDelete={deleteReminder} />
            ))}

            {completed.length > 0 && (
              <>
                <div style={{ padding: '12px 24px 6px', fontSize: 11, color: 'var(--t-ghost)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Concluídos ({completed.length})
                </div>
                {completed.slice(0, 5).map((r) => (
                  <ReminderRow key={r.id} reminder={r} onComplete={completeReminder} onDelete={deleteReminder} />
                ))}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    )
  }

  // Mini panel (flutuante)
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={spring.morph}
      className="glass"
      style={{
        position: 'fixed', top: 66, right: 24, zIndex: 50,
        width: 320, maxHeight: 400,
        borderRadius: 'var(--r-sm)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--hair)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-hi)' }}>Lembretes</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowCreate(!showCreate)} style={{ ...btnStyleSm, color: 'var(--accent)' }}>+</button>
          <button onClick={() => setFullscreen(true)} style={btnStyleSm} title="Expandir">⤢</button>
          <button onClick={onClose} style={btnStyleSm}>✕</button>
        </div>
      </div>

      {/* Quick create */}
      <AnimatePresence>
        {showCreate ? (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--hair)', display: 'flex', gap: 8 }}>
              <input
                value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Lembrete..."
                style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && createReminder()}
              />
              <button onClick={createReminder} style={{ ...btnStyleSm, color: 'var(--accent)', fontSize: 16 }}>↵</button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 300, padding: '4px 0' }}>
        {pending.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--t-ghost)', padding: '20px 16px', fontSize: 12 }}>
            Sem lembretes pendentes
          </p>
        ) : pending.map((r) => (
          <ReminderRow key={r.id} reminder={r} onComplete={completeReminder} onDelete={deleteReminder} compact />
        ))}
      </div>
    </motion.div>
  )
}

// -- Reminder row --------------------------------------------------

function ReminderRow({ reminder, onComplete, onDelete, compact }: {
  reminder: Reminder
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  compact?: boolean
}) {
  const dueDate = new Date(reminder.dueAt)
  const isOverdue = !reminder.completed && dueDate < new Date()
  const timeStr = dueDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const dateStr = dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  return (
    <div style={{
      padding: compact ? '8px 16px' : '10px 24px',
      display: 'flex', alignItems: 'center', gap: 10,
      borderBottom: '1px solid rgba(255,255,255,.03)',
      opacity: reminder.completed ? 0.5 : 1,
    }}>
      {/* Checkbox */}
      <button
        onClick={() => onComplete(reminder.id)}
        style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
          border: `1.5px solid ${reminder.completed ? 'var(--st-executing)' : isOverdue ? 'var(--st-error)' : 'var(--t-ghost)'}`,
          background: reminder.completed ? 'var(--st-executing)' : 'transparent',
          cursor: 'pointer', display: 'grid', placeItems: 'center',
          color: '#fff', fontSize: 10,
        }}
      >
        {reminder.completed ? '✓' : ''}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: compact ? 12.5 : 14, color: 'var(--t-hi)',
          textDecoration: reminder.completed ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {reminder.title}
        </div>
        <div style={{
          fontSize: 11, fontFamily: 'var(--f-mono)',
          color: isOverdue ? 'var(--st-error)' : 'var(--t-ghost)',
          marginTop: 2,
        }}>
          {dateStr} · {timeStr}
          {isOverdue && ' · atrasado'}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(reminder.id)}
        style={{ ...btnStyleSm, fontSize: 12, color: 'var(--t-ghost)' }}
        title="Deletar"
      >
        🗑
      </button>
    </div>
  )
}

// -- Styles --------------------------------------------------------

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 'var(--r-xs)',
  background: 'var(--fill-1)',
  border: '1px solid var(--hair)',
  color: 'var(--t-hi)',
  fontSize: 13,
  fontFamily: 'var(--f)',
  outline: 'none',
}

const btnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 'var(--r-pill)',
  background: 'var(--fill-1)',
  border: 'none',
  color: 'var(--t-mid)',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'var(--f)',
}

const btnStyleSm: React.CSSProperties = {
  width: 24, height: 24, borderRadius: '50%',
  background: 'none', border: 'none',
  color: 'var(--t-low)', fontSize: 14,
  cursor: 'pointer', display: 'grid', placeItems: 'center',
}
