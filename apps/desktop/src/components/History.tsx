import { useEffect } from 'react';
import { useJarvisStore } from '../stores/jarvis.store';
import { useSocket } from '../hooks/useSocket';
import type { Conversation } from '@jarvis/shared';

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `${days} dias atras`;
  return date.toLocaleDateString('pt-BR');
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function History() {
  const { conversations, setView, setConversationId, setMessages, newConversation } =
    useJarvisStore();
  const { loadConversations } = useSocket();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleSelect = (conv: Conversation) => {
    setConversationId(conv.id);
    setMessages([]);
    setView('chat');
    // Messages will be loaded by the chat view
  };

  const handleNewChat = () => {
    newConversation();
    setView('chat');
  };

  // Group by date
  const grouped = conversations.reduce(
    (acc, conv) => {
      const label = formatDate(conv.updatedAt);
      if (!acc[label]) acc[label] = [];
      acc[label].push(conv);
      return acc;
    },
    {} as Record<string, Conversation[]>,
  );

  return (
    <div className="flex flex-col min-h-screen p-6 bg-jarvis-bg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setView('chat')}
          className="text-sm text-jarvis-muted hover:text-jarvis-text transition-colors"
        >
          ← Voltar
        </button>
        <h1 className="text-lg font-light text-jarvis-text">Conversas</h1>
        <button
          onClick={handleNewChat}
          className="text-sm text-jarvis-primary hover:text-jarvis-text transition-colors"
        >
          + Nova
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 space-y-6 max-w-lg mx-auto w-full">
        {Object.entries(grouped).map(([dateLabel, convs]) => (
          <div key={dateLabel}>
            <p className="text-xs text-jarvis-muted mb-2 uppercase tracking-wider">{dateLabel}</p>
            <div className="space-y-2">
              {convs.map((conv) => {
                const msgCount = conv._count?.messages ?? conv.messageCount ?? 0;
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelect(conv)}
                    className="w-full text-left px-4 py-3 rounded-xl bg-jarvis-surface border border-jarvis-border hover:border-jarvis-primary/40 transition-colors"
                  >
                    <p className="text-sm text-jarvis-text truncate">{conv.title}</p>
                    <p className="text-xs text-jarvis-muted mt-1">
                      {formatTime(conv.updatedAt)} · {msgCount} msgs
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {conversations.length === 0 && (
          <p className="text-center text-jarvis-muted text-sm mt-12">
            Nenhuma conversa ainda. Comece falando com o Jarvis!
          </p>
        )}
      </div>
    </div>
  );
}
