import { useState, useRef, useEffect } from 'react';
import { useJarvisStore } from '../stores/jarvis.store';
import { useSocket } from '../hooks/useSocket';
import { Orb } from './hud/Orb';

export function Chat() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { sendMessage } = useSocket();
  const { state, messages, streamingText, connected, lastDecision, toolExecutions, setView } = useJarvisStore();

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, toolExecutions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  const stateLabel: Record<string, string> = {
    idle: 'Online',
    listening: 'Ouvindo...',
    thinking: 'Pensando...',
    speaking: 'Falando...',
  };

  const hasMessages = messages.length > 0 || streamingText;

  return (
    <div className="flex flex-col min-h-screen bg-jarvis-bg">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3">
        <button
          onClick={() => useJarvisStore.getState().newConversation()}
          className="text-sm text-jarvis-muted hover:text-jarvis-text transition-colors"
        >
          + Nova conversa
        </button>
        <div className="flex items-center gap-2 text-sm text-jarvis-muted">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: connected ? '#10b981' : '#ef4444' }}
          />
          {connected ? 'Conectado' : 'Desconectado'}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('history')}
            className="text-sm text-jarvis-muted hover:text-jarvis-text transition-colors"
          >
            Historico
          </button>
          <button
            onClick={() => setView('settings')}
            className="text-sm text-jarvis-muted hover:text-jarvis-text transition-colors"
          >
            Config
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {!hasMessages && (
          <>
            <Orb state={state} />
            <p className="mt-4 text-lg font-light tracking-wide text-jarvis-muted">
              {stateLabel[state]}
            </p>
            <p className="mt-2 text-sm text-jarvis-muted/60">
              Como posso ajudar?
            </p>
          </>
        )}

        {hasMessages && (
          <>
            {/* Mini orb */}
            <div className="mb-4">
              <div
                className="w-8 h-8 rounded-full"
                style={{
                  background: state === 'thinking'
                    ? 'radial-gradient(circle, #7c3aed88, #7c3aed22)'
                    : 'radial-gradient(circle, #00d4ff88, #00d4ff22)',
                  boxShadow: state === 'thinking'
                    ? '0 0 20px rgba(124, 58, 237, 0.3)'
                    : '0 0 20px rgba(0, 212, 255, 0.2)',
                }}
              />
            </div>

            {/* Messages */}
            <div className="w-full max-w-2xl flex-1 overflow-y-auto space-y-3 mb-4" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm max-w-[75%] ${
                      msg.role === 'user'
                        ? 'bg-jarvis-primary/15 text-jarvis-text rounded-br-md'
                        : 'bg-jarvis-surface text-jarvis-text rounded-bl-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-[10px] text-jarvis-muted/50 mt-1">
                      {new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {msg.provider && ` · ${msg.provider}`}
                    </p>
                  </div>
                </div>
              ))}

              {streamingText && (
                <div className="flex justify-start">
                  <div className="px-4 py-2.5 rounded-2xl rounded-bl-md text-sm bg-jarvis-surface text-jarvis-text max-w-[75%]">
                    <p className="whitespace-pre-wrap">
                      {streamingText}
                      <span className="animate-pulse text-jarvis-primary">|</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Tool execution indicators */}
              {toolExecutions.length > 0 && (
                <div className="flex flex-col items-center gap-1">
                  {toolExecutions.map((te, i) => (
                    <div
                      key={`${te.toolName}-${i}`}
                      className={`flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg border ${
                        te.status === 'executing'
                          ? 'bg-jarvis-primary/10 border-jarvis-primary/30 text-jarvis-primary'
                          : te.result?.success
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                      }`}
                    >
                      {te.status === 'executing' ? (
                        <span className="animate-spin inline-block w-3 h-3 border border-current border-t-transparent rounded-full" />
                      ) : te.result?.success ? (
                        <span>&#10003;</span>
                      ) : (
                        <span>&#10007;</span>
                      )}
                      <span className="font-mono">{te.toolName}</span>
                      {te.result?.message && (
                        <span className="text-jarvis-muted">— {te.result.message}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Decision indicator */}
              {lastDecision && state === 'thinking' && (
                <div className="flex justify-center">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-jarvis-surface text-jarvis-muted border border-jarvis-border">
                    {lastDecision.provider === 'local' ? '🏠' : '☁️'} {lastDecision.model}
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-6 pb-6">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite algo para o Jarvis..."
            className="w-full px-4 py-3 rounded-xl outline-none text-sm bg-jarvis-surface text-jarvis-text border border-jarvis-border focus:ring-2 focus:ring-jarvis-primary/50 transition-all placeholder:text-jarvis-muted/50"
          />
        </form>
      </div>
    </div>
  );
}
