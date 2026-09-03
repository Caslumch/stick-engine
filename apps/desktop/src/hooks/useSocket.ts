import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WsEvent } from '@jarvis/shared';
import { extractNameFromMemories } from './useWelcome';
import type {
  StateChangePayload,
  MessageStreamPayload,
  MessageCompletePayload,
  MessageFillerPayload,
  DecisionMadePayload,
  IntentClassification,
  Conversation,
  Message,
} from '@jarvis/shared';
import { useJarvisStore } from '../stores/jarvis.store';
import { ttsLock } from './ttsLock';
import { showToast } from '../ui/Toast';
import { API_URL, TTS_URL } from '../app/endpoints';

const SETTING_LABELS: Record<string, string> = {
  'llm.preferLocal': 'Preferir local',
  'openai.webSearch': 'Web Search (cloud)',
  'voice.wakeWord': 'Wake word',
  'voice.bargeIn': 'Barge-in',
  'tts.dynamicSpeed': 'Velocidade dinâmica',
  'personality.tone': 'Tom',
  'personality.proactivity': 'Proatividade',
  'personality.verbosity': 'Verbosidade',
  'llm.ollama.model': 'Modelo',
  'tts.engine': 'Engine TTS',
  'tts.voice': 'Voz',
  'tts.speed': 'Velocidade',
  'agent.name': 'Nome do agente',
  'agent.systemPrompt': 'System prompt',
  'openai.apiKey': 'OpenAI API Key',
  'ui.accent': 'Cor de destaque',
  'ui.bgPreset': 'Fundo',
  'ui.bgBlur': 'Blur do fundo',
  'ui.bgDim': 'Escurecimento do fundo',
};

function settingToastMessage(key: string, value: string): string {
  const label = SETTING_LABELS[key];

  // Toggle (true/false)
  if (value === 'true' || value === 'false') {
    const state = value === 'true' ? 'ativado' : 'desativado';
    return label ? `${label} ${state}` : `Configuração ${state}`;
  }

  // Valores longos (API keys, prompts)
  if (value.length > 30) return label ? `${label} salvo` : 'Salvo';

  // Valores curtos com label
  if (label) return `${label}: ${value}`;

  return 'Salvo';
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const store = useJarvisStore();

  useEffect(() => {
    const socket = io(API_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to Jarvis API');
      store.setConnected(true);
      if (useJarvisStore.getState().state === 'offline') {
        store.setState('idle');
      }
      // Carregar settings do banco imediatamente ao conectar
      socket.emit(WsEvent.SettingsGet, {}, (data: Record<string, string>) => {
        if (!data) return;
        store.setSettings(data);

        // Se o nome nao esta nos ajustes, tenta aprender pelas memorias da conversa
        if (!data['user.name']) {
          socket.emit(WsEvent.MemoryList, {}, (mems: Array<{ type: string; content: string }>) => {
            if (!Array.isArray(mems)) return;
            const learned = extractNameFromMemories(mems);
            if (learned) {
              store.setSettings({ ...useJarvisStore.getState().settings, 'user.name': learned });
            }
          });
        }
      });

      // Nao restaura conversa antiga: o app sempre abre numa conversa nova
      // (ver useWelcome). O historico continua acessivel na tela de Historico.
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Jarvis API');
      store.setConnected(false);
      store.setState('offline');
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      console.log(`Reconnecting... attempt ${attempt}`);
    });

    socket.on(WsEvent.StateChange, (payload: StateChangePayload) => {
      // Enquanto TTS está ativo, bloquear QUALQUER mudança de estado vinda do backend
      if (ttsLock.active) return;
      const current = useJarvisStore.getState().state;
      if (current === 'speaking' && (payload.state === 'idle' || payload.state === 'thinking')) return;
      store.setState(payload.state);
      // Filler text comes with 'thinking' state
      if (payload.filler) {
        store.setFillerText(payload.filler);
      } else if (payload.state === 'idle') {
        store.setFillerText('');
      }
    });

    socket.on(WsEvent.MessageFiller, (payload: MessageFillerPayload) => {
      store.setFillerText(payload.text);
    });

    socket.on(WsEvent.MessageStream, (payload: MessageStreamPayload) => {
      store.appendStreamToken(payload.token);
    });

    socket.on(WsEvent.MessageComplete, (payload: MessageCompletePayload) => {
      store.clearStream();
      store.clearToolExecutions();
      store.setFillerText('');
      store.addMessage(payload.message);

      if (!useJarvisStore.getState().conversationId) {
        store.setConversationId(payload.conversationId);
      }
    });

    socket.on(WsEvent.MessageError, (payload: { error: string }) => {
      store.clearStream();
      store.addMessage({
        id: crypto.randomUUID(),
        conversationId: 'error',
        role: 'assistant',
        content: `Erro: ${payload.error}`,
        createdAt: new Date().toISOString(),
      });
    });

    socket.on(WsEvent.DecisionMade, (payload: DecisionMadePayload) => {
      store.setLastDecision(payload);
    });

    socket.on(WsEvent.IntentClassified, (payload: IntentClassification) => {
      store.setLastIntent(payload);
    });

    socket.on(WsEvent.CapabilityExecuting, (payload: { toolName: string; args: Record<string, unknown> }) => {
      store.addToolExecution({
        toolName: payload.toolName,
        args: payload.args,
        status: 'executing',
      });
    });

    socket.on(WsEvent.CapabilityResult, (payload: { toolName: string; result: { success: boolean; message?: string; data?: unknown } }) => {
      store.updateToolExecution(payload.toolName, payload.result);
    });

    socket.on(WsEvent.ReminderDue, (payload: { id: string; title: string; description?: string }) => {
      // Notificação do sistema
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Jarvis — Lembrete', {
          body: payload.title + (payload.description ? `\n${payload.description}` : ''),
        });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then((p) => {
          if (p === 'granted') {
            new Notification('Jarvis — Lembrete', { body: payload.title });
          }
        });
      }

      // Falar o lembrete via TTS (com controle de estado)
      const text = `Lucas, lembrete: ${payload.title}.`;
      const settings = useJarvisStore.getState().settings;
      const engine = settings['tts.engine'] || 'edge';
      const voice = settings['tts.voice'] || '';
      store.setState('speaking');
      ttsLock.active = true;
      fetch(`${TTS_URL}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, engine, voice }),
      }).then(async (resp) => {
        if (!resp.ok) { ttsLock.active = false; store.setState('idle'); return; }
        const { getTTSBus, resumeTTSBus } = await import('./ttsAudioBus');
        const bytes = await resp.arrayBuffer();
        const bus = getTTSBus();
        await resumeTTSBus();
        const audioBuffer = await bus.ctx.decodeAudioData(bytes.slice(0));
        const source = bus.ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(bus.input);
        source.onended = () => { ttsLock.active = false; store.setState('idle'); };
        source.start();
      }).catch(() => { ttsLock.active = false; store.setState('idle'); });

      // Adicionar como mensagem na conversa
      store.addMessage({
        id: 'reminder-' + payload.id,
        conversationId: useJarvisStore.getState().conversationId || 'reminder',
        role: 'assistant',
        content: `🔔 **Lembrete:** ${payload.title}${payload.description ? `\n${payload.description}` : ''}`,
        createdAt: new Date().toISOString(),
      });
    });

    socket.on(WsEvent.ProductImages, (payload: { images: Array<{ title: string; image: string; thumbnail: string }> }) => {
      store.setProductImages(payload.images);
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = useCallback((text: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    const { conversationId } = useJarvisStore.getState();

    store.addMessage({
      id: crypto.randomUUID(),
      conversationId: conversationId ?? 'pending',
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    });

    socket.emit(WsEvent.MessageSend, { text, conversationId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConversations = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit(WsEvent.ConversationList, {}, (data: Conversation[]) => {
      store.setConversations(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit(WsEvent.SettingsGet, {}, (data: Record<string, string>) => {
      store.setSettings(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateSetting = useCallback((key: string, value: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    // Update local state immediately (for instant UI feedback)
    store.updateSetting(key, value);

    // Debounce the socket emit + toast for slider-type settings
    const isSlider = key === 'ui.bgBlur' || key === 'ui.bgDim';
    if (isSlider) {
      if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = setTimeout(() => {
        socket.emit(WsEvent.SettingsUpdate, { key, value }, (ack: any) => {
          if (ack?.error) { showToast('Erro ao salvar', 'error'); return; }
          showToast(settingToastMessage(key, value), 'success');
        });
      }, 500);
    } else {
      socket.emit(WsEvent.SettingsUpdate, { key, value }, (ack: any) => {
        if (ack?.error) { showToast('Erro ao salvar', 'error'); return; }
        showToast(settingToastMessage(key, value), 'success');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConversationMessages = useCallback((conversationId: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit(WsEvent.ConversationMessages, { conversationId }, (data: Message[]) => {
      store.setMessages(data);
      store.setConversationId(conversationId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteConversation = useCallback((conversationId: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit(WsEvent.ConversationDelete, { conversationId }, () => {
      // Se a conversa deletada é a atual, limpar
      if (useJarvisStore.getState().conversationId === conversationId) {
        store.newConversation();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mcpList = useCallback((): Promise<any[]> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) return resolve([]);
      socket.emit(WsEvent.McpList, {}, (data: any[]) => resolve(data));
    });
  }, []);

  const mcpAdd = useCallback((data: {
    name: string; transport: string; command?: string; args?: string; url?: string; apiKey?: string;
  }): Promise<any> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) return resolve({ error: 'not connected' });
      socket.emit(WsEvent.McpAdd, data, (result: any) => resolve(result));
    });
  }, []);

  const mcpRemove = useCallback((id: string): Promise<any> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) return resolve({ error: 'not connected' });
      socket.emit(WsEvent.McpRemove, { id }, (result: any) => resolve(result));
    });
  }, []);

  const mcpReconnect = useCallback((id: string): Promise<any> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) return resolve({ error: 'not connected' });
      socket.emit(WsEvent.McpReconnect, { id }, (result: any) => resolve(result));
    });
  }, []);

  return {
    sendMessage, loadConversations, loadConversationMessages, deleteConversation,
    loadSettings, updateSetting,
    mcpList, mcpAdd, mcpRemove, mcpReconnect,
  };
}
