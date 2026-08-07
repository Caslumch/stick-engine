import { create } from 'zustand';
import type { JarvisState, Message, Conversation, DecisionMadePayload, IntentClassification } from '@jarvis/shared';

type View = 'voice' | 'chat' | 'history' | 'settings';

export interface ToolExecution {
  toolName: string;
  args?: Record<string, unknown>;
  result?: { success: boolean; message?: string; data?: unknown };
  status: 'executing' | 'done';
}

interface JarvisStore {
  // State
  state: JarvisState;
  connected: boolean;
  view: View;
  isAmbient: boolean;

  // Conversation
  conversationId: string | null;
  conversations: Conversation[];
  messages: Message[];
  streamingText: string;

  // Decision & Intent
  lastDecision: DecisionMadePayload | null;
  lastIntent: IntentClassification | null;

  // Tool execution
  toolExecutions: ToolExecution[];

  /** Último resultado de tool com dados ricos — persiste após clear pra DataArtifact */
  lastRichResult: { toolName: string; result: ToolExecution['result']; capturedAt: number } | null;

  /** Imagens de produtos da última resposta */
  productImages: Array<{ title: string; image: string; thumbnail: string }>;

  // Filler
  fillerText: string;

  // Settings
  settings: Record<string, string>;

  // Actions
  setState: (state: JarvisState) => void;
  setConnected: (connected: boolean) => void;
  setView: (view: View) => void;
  setAmbient: (v: boolean) => void;
  setConversationId: (id: string | null) => void;
  setConversations: (conversations: Conversation[]) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  appendStreamToken: (token: string) => void;
  clearStream: () => void;
  newConversation: () => void;
  setLastDecision: (decision: DecisionMadePayload) => void;
  setLastIntent: (intent: IntentClassification) => void;
  addToolExecution: (exec: ToolExecution) => void;
  updateToolExecution: (toolName: string, result: ToolExecution['result']) => void;
  clearToolExecutions: () => void;
  clearLastRichResult: () => void;
  setProductImages: (images: Array<{ title: string; image: string; thumbnail: string }>) => void;
  setFillerText: (text: string) => void;
  setSettings: (settings: Record<string, string>) => void;
  updateSetting: (key: string, value: string) => void;
}

export const useJarvisStore = create<JarvisStore>((set) => ({
  state: 'idle',
  connected: false,
  view: 'voice',
  isAmbient: false,

  conversationId: null,
  conversations: [],
  messages: [],
  streamingText: '',

  lastDecision: null,
  lastIntent: null,

  toolExecutions: [],
  lastRichResult: null,
  productImages: [],

  fillerText: '',

  settings: {},

  setState: (state) => set({ state }),
  setConnected: (connected) => set({ connected }),
  setView: (view) => set({ view }),
  setAmbient: (isAmbient) => set({ isAmbient }),
  setConversationId: (conversationId) => set({ conversationId }),
  setConversations: (conversations) => set({ conversations }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setMessages: (messages) => set({ messages }),
  appendStreamToken: (token) => set((s) => ({ streamingText: s.streamingText + token })),
  clearStream: () => set({ streamingText: '' }),
  newConversation: () => set({ conversationId: null, messages: [], streamingText: '', fillerText: '', lastDecision: null, lastIntent: null, toolExecutions: [], lastRichResult: null }),
  setLastDecision: (lastDecision) => set({ lastDecision }),
  setLastIntent: (lastIntent) => set({ lastIntent }),
  addToolExecution: (exec) => set((s) => ({ toolExecutions: [...s.toolExecutions, exec] })),
  updateToolExecution: (toolName, result) =>
    set((s) => {
      const update: Partial<JarvisStore> = {
        toolExecutions: s.toolExecutions.map((te) =>
          te.toolName === toolName && te.status === 'executing'
            ? { ...te, result, status: 'done' as const }
            : te,
        ),
      };
      // Salvar resultado rico pra DataArtifact (persiste após clear)
      if (result && (result.data || result.message)) {
        update.lastRichResult = { toolName, result, capturedAt: Date.now() };
      }
      return update;
    }),
  clearToolExecutions: () => set({ toolExecutions: [] }),
  clearLastRichResult: () => set({ lastRichResult: null, productImages: [] }),
  setProductImages: (productImages) => set({ productImages }),
  setFillerText: (fillerText) => set({ fillerText }),
  setSettings: (settings) => set({ settings }),
  updateSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
}));
