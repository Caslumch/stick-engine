import { useState, useRef, useEffect } from 'react'
import { useJarvisStore } from '../stores/jarvis.store'
import { useSocket } from '../hooks/useSocket'
import { Composer } from '../ui/Composer'
import { ToolCard } from '../ui/ToolCard'
import { HistoryDrawer } from '../ui/HistoryDrawer'
import { Markdown } from '../ui/Markdown'

/**
 * Tela de chat — coluna de 700px, pill de sessão, thread com fade,
 * bolha de vidro pro usuário, texto sem caixa pro agente.
 * Seções 10 e 11 do DESIGN_SYSTEM.md.
 */
export function ChatScreen() {
  const messages = useJarvisStore((s) => s.messages)
  const streamingText = useJarvisStore((s) => s.streamingText)
  const toolExecutions = useJarvisStore((s) => s.toolExecutions)
  const productImages = useJarvisStore((s) => s.productImages)
  const { sendMessage } = useSocket()
  const endRef = useRef<HTMLDivElement>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  return (
    <>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        paddingTop: 76,
      }}>
        {/* Session pill */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="glass"
          style={{
            position: 'fixed',
            top: 22,
            left: '50%',
            translate: '-50% 0',
            zIndex: 40,
            height: 36,
            padding: '0 18px',
            borderRadius: 'var(--r-pill)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: 'var(--t-mid)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--f)',
          }}
        >
          <span style={{ color: 'var(--t-hi)', fontWeight: 500 }}>
            {messages.length > 0 ? 'Conversa' : 'Nova conversa'}
          </span>
          <span style={{ color: 'var(--t-ghost)' }}>·</span>
          <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </button>

        {/* Thread */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 24px 200px',
          maskImage: 'linear-gradient(#000 calc(100% - 190px), transparent calc(100% - 130px))',
        }}>
          <div style={{
            maxWidth: 700,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
          }}>
            {messages.map((msg) => (
              msg.role === 'user' ? (
                <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, maxWidth: '76%' }}>
                    <div className="glass" style={{
                      padding: '13px 18px',
                      borderRadius: 'var(--r-md) var(--r-md) 6px var(--r-md)',
                      color: 'var(--t-hi)',
                      fontSize: 15,
                    }}>
                      {msg.content}
                    </div>
                    <MsgTime time={msg.createdAt} />
                  </div>
                </div>
              ) : (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Ferramentas usadas para produzir esta resposta */}
                  {toolExecutions
                    .filter((te) => te.messageId === msg.id)
                    .map((te, i) => (
                      <ToolCard key={`${msg.id}-${te.toolName}-${i}`} exec={te} />
                    ))}

                <div style={{ display: 'flex', gap: 12 }}>
                  {/* Avatar: ponto de estado */}
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    flex: '0 0 26px',
                    marginTop: 3,
                    display: 'grid',
                    placeItems: 'center',
                  }}>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      boxShadow: '0 0 12px 1px rgba(var(--accent-rgb), .6)',
                      transition: 'background .7s',
                    }} />
                  </div>
                  <div style={{ maxWidth: '88%' }}>
                    <div style={{
                      fontSize: 15.5,
                      lineHeight: 1.6,
                      color: 'var(--t-mid)',
                      paddingTop: 2,
                    }}>
                      <Markdown content={cleanCitations(msg.content)} />
                    </div>
                    <MsgTime time={msg.createdAt} />
                  </div>
                </div>
                </div>
              )
            ))}

            {/* Execucoes ainda sem resposta (em andamento) ficam no fim */}
            {toolExecutions.filter((te) => !te.messageId).map((te, i) => (
              <ToolCard key={`pending-${te.toolName}-${i}`} exec={te} />
            ))}

            {/* Imagens de produtos */}
            {productImages.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(productImages.length, 3)}, 1fr)`,
                gap: 10,
                maxWidth: 'min(88%, 620px)',
                marginLeft: 38,
                marginBottom: 8,
                overflow: 'hidden',
              }}>
                {productImages.map((img, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <img
                      src={img.thumbnail || img.image}
                      alt={img.title}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: 120,
                        objectFit: 'cover',
                        borderRadius: 'var(--r-xs)',
                        background: 'var(--fill-1)',
                      }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <span style={{
                      fontSize: 11,
                      color: 'var(--t-low)',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {img.title}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Streaming */}
            {streamingText && (
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  flex: '0 0 26px',
                  marginTop: 3,
                  display: 'grid',
                  placeItems: 'center',
                }}>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    boxShadow: '0 0 12px 1px rgba(var(--accent-rgb), .6)',
                    transition: 'background .7s',
                  }} />
                </div>
                <div style={{
                  fontSize: 15.5,
                  lineHeight: 1.6,
                  color: 'var(--t-mid)',
                  paddingTop: 2,
                }}>
                  {streamingText}
                  <span style={{
                    display: 'inline-block',
                    width: 2,
                    height: 18,
                    background: 'var(--accent)',
                    marginLeft: 3,
                    translate: '0 3px',
                    borderRadius: 2,
                    animation: 'blink 1.05s steps(1) infinite',
                  }} />
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>
        </div>

        {/* Composer */}
        <Composer onSend={sendMessage} />
      </div>

      <HistoryDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </>
  )
}

/** Timestamp da mensagem */
function MsgTime({ time }: { time: string }) {
  const date = new Date(time)
  const str = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return (
    <span style={{
      fontSize: 11,
      color: 'var(--t-ghost)',
      fontFamily: 'var(--f-mono)',
      fontVariantNumeric: 'tabular-nums',
      paddingLeft: 38,
    }}>
      {str}
    </span>
  )
}

/** Remove artifacts de citação da Responses API: [[cite:...]], 【...】 */
function cleanCitations(text: string): string {
  return text
    .replace(/\[\[cite[^\]]*\]\]/g, '')
    .replace(/\u3010[^】]*\u3011/g, '')  // 【turn0forecast0】
    .replace(/\s{2,}/g, ' ')
    .trim()
}
