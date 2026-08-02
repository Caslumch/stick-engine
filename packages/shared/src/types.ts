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

// === Memory ===

export type MemoryType = 'preference' | 'person' | 'project' | 'device' | 'habit' | 'fact';
export type MemorySource = 'explicit' | 'inferred' | 'conversation';

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  source: MemorySource;
  createdAt: string;
  updatedAt: string;
}

// === Intent Classification ===

export type IntentType = 'information' | 'action' | 'conversation' | 'confirmation' | 'memory';

export interface IntentClassification {
  intent: IntentType;
  confidence: number;
  suggestion?: string;
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
  MemoryList = 'memory:list',
  MemorySave = 'memory:save',
  MemoryDelete = 'memory:delete',
  MemorySearch = 'memory:search',

  // Server -> Client
  MessageStream = 'message:stream',
  MessageComplete = 'message:complete',
  MessageError = 'message:error',
  MessageFiller = 'message:filler',
  IntentClassified = 'intent:classified',
  StateChange = 'state:change',
  DecisionMade = 'decision:made',
  CapabilityExecuting = 'capability:executing',
  CapabilityResult = 'capability:result',
  ReminderDue = 'reminder:due',
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
  filler?: string;
  metadata?: {
    provider?: string;
    tool?: string;
  };
}

export interface MessageFillerPayload {
  text: string;
  conversationId: string;
}

export interface DecisionMadePayload {
  provider: 'local' | 'cloud';
  model: string;
  reason: string;
}
