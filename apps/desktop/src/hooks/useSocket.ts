import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WsEvent } from '@jarvis/shared';
import type {
  StateChangePayload,
  MessageStreamPayload,
  MessageCompletePayload,
  DecisionMadePayload,
  Conversation,
  Message,
} from '@jarvis/shared';
import { useJarvisStore } from '../stores/jarvis.store';

const API_URL = 'http://localhost:3000';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const store = useJarvisStore();

  useEffect(() => {
    const socket = io(API_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to Jarvis API');
      store.setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Jarvis API');
      store.setConnected(false);
    });

    socket.on(WsEvent.StateChange, (payload: StateChangePayload) => {
      // Não deixar o backend sobrescrever 'speaking' — o TTS do frontend controla esse estado
      const current = useJarvisStore.getState().state;
      if (current === 'speaking' && payload.state === 'idle') return;
      store.setState(payload.state);
    });

    socket.on(WsEvent.MessageStream, (payload: MessageStreamPayload) => {
      store.appendStreamToken(payload.token);
    });

    socket.on(WsEvent.MessageComplete, (payload: MessageCompletePayload) => {
      store.clearStream();
      store.clearToolExecutions();
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

  const updateSetting = useCallback((key: string, value: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    store.updateSetting(key, value);
    socket.emit(WsEvent.SettingsUpdate, { key, value });
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

  return { sendMessage, loadConversations, loadConversationMessages, deleteConversation, loadSettings, updateSetting };
}
