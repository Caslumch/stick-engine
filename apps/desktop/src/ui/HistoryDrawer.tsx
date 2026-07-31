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
  const { loadConversations, loadConversationMessages, deleteConversation } = useSocket()

  useEffect(() => {
    if (open) loadConversations()
  }, [open, loadConversations])

  const handleSelect = (conv: Conversation) => {
    loadConversationMessages(conv.id)
    onClose()
  }

  const handleDelete = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation()
    deleteConversation(conv.id)
    // Remover da lista local
    useJarvisStore.getState().setConversations(
      useJarvisStore.getState().conversations.filter((c) => c.id !== conv.id)
    )
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
                  <div
                    key={conv.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 'var(--r-xs)',
                      transition: 'background .2s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--fill-2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <button
                      onClick={() => handleSelect(conv)}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        padding: '10px 8px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'var(--f)',
                        minWidth: 0,
                      }}
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
                    <button
                      onClick={(e) => handleDelete(e, conv)}
                      title="Deletar conversa"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'var(--t-ghost)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        marginRight: 4,
                        flexShrink: 0,
                        transition: 'color .2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--st-error)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--t-ghost)'}
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
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
