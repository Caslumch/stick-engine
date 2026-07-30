import { useEffect } from 'react'
import { useJarvisStore } from '../stores/jarvis.store'
import { useSocket } from '../hooks/useSocket'
import type { Conversation } from '@jarvis/shared'

/**
 * Gaveta de histórico — ~300px pela esquerda, sobre a tela de chat.
 * Abre pelo pill de sessão e atalho. Busca por conteúdo (não só título).
 */

interface HistoryDrawerProps {
  open: boolean
  onClose: () => void
}

export function HistoryDrawer({ open, onClose }: HistoryDrawerProps) {
  const conversations = useJarvisStore((s) => s.conversations)
  const { loadConversations } = useSocket()

  useEffect(() => {
    if (open) loadConversations()
  }, [open, loadConversations])

  const handleSelect = (conv: Conversation) => {
    useJarvisStore.getState().setConversationId(conv.id)
    useJarvisStore.getState().setMessages([])
    onClose()
  }

  const handleNew = () => {
    useJarvisStore.getState().newConversation()
    onClose()
  }

  // Agrupar por data
  const grouped = conversations.reduce((acc, conv) => {
    const label = formatDate(conv.updatedAt)
    if (!acc[label]) acc[label] = []
    acc[label].push(conv)
    return acc
  }, {} as Record<string, Conversation[]>)

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 44,
          background: 'rgba(8, 12, 10, .32)',
          backdropFilter: 'blur(6px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .26s linear',
        }}
      />

      {/* Gaveta */}
      <div
        className="glass"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 300,
          zIndex: 45,
          borderRadius: '0 var(--r-lg) var(--r-lg) 0',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform .42s var(--sp-morph)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 18px 12px',
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--t-hi)' }}>
            Conversas
          </span>
          <button
            onClick={handleNew}
            style={{
              fontSize: 13,
              color: 'var(--accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--f)',
              transition: 'color .7s',
            }}
          >
            + Nova
          </button>
        </div>

        {/* Lista */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 12px 20px',
          maskImage: 'linear-gradient(#000 calc(100% - 40px), transparent)',
        }}>
          {Object.entries(grouped).map(([dateLabel, convs]) => (
            <div key={dateLabel} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11,
                color: 'var(--t-ghost)',
                fontWeight: 500,
                padding: '6px 6px 4px',
                textTransform: 'uppercase',
                letterSpacing: '.04em',
              }}>
                {dateLabel}
              </div>
              {convs.map((conv) => {
                const count = conv._count?.messages ?? conv.messageCount ?? 0
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelect(conv)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 8px',
                      borderRadius: 'var(--r-xs)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--f)',
                      transition: 'background .2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--fill-2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <div style={{
                      fontSize: 13.5,
                      color: 'var(--t-hi)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {conv.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t-low)', marginTop: 2 }}>
                      {formatTime(conv.updatedAt)} · {count} msgs
                    </div>
                  </button>
                )
              })}
            </div>
          ))}

          {conversations.length === 0 && (
            <div style={{
              padding: '40px 12px',
              textAlign: 'center',
              color: 'var(--t-ghost)',
              fontSize: 13,
            }}>
              Nenhuma conversa ainda.
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  if (days < 7) return `${days} dias atrás`
  return date.toLocaleDateString('pt-BR')
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
