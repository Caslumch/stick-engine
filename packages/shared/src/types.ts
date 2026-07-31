// === Jarvis States ===

export type JarvisState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'executing' | 'error' | 'offline';

// === Messages ===

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  provider?: string;
  model?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  messageCount?: number;
  _count?: { messages: number };
  createdAt: string;
  updatedAt: string;
}

// === Tool Calling ===

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: CapabilityResult;
}

export interface CapabilityResult {
  success: boolean;
  data?: unknown;
  message?: string;
}

// === WebSocket Events ===

export enum WsEvent {
  // Client -> Server
  MessageSend = 'message:send',
  ConversationCreate = 'conversation:create',
  ConversationList = 'conversation:list',
  ConversationMessages = 'conversation:messages',
  ConversationDelete = 'conversation:delete',
  StateGet = 'state:get',
  SettingsGet = 'settings:get',
  SettingsUpdate = 'settings:update',

  // Server -> Client
  MessageStream = 'message:stream',
  MessageComplete = 'message:complete',
  MessageError = 'message:error',
  StateChange = 'state:change',
  DecisionMade = 'decision:made',
  CapabilityExecuting = 'capability:executing',
  CapabilityResult = 'capability:result',
}

// === WebSocket Payloads ===

export interface MessageSendPayload {
  text: string;
  conversationId?: string;
}

export interface MessageStreamPayload {
  token: string;
  conversationId: string;
}

export interface MessageCompletePayload {
  message: Message;
  conversationId: string;
}

export interface StateChangePayload {
  state: JarvisState;
  metadata?: {
    provider?: string;
    tool?: string;
  };
}

export interface DecisionMadePayload {
  provider: 'local' | 'cloud';
  model: string;
  reason: string;
}
