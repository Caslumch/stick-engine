import type { ToolSet } from 'ai';

export const LLM_PROVIDERS = Symbol('LLM_PROVIDERS');

export type LlmStreamCallback = (token: string) => void;

export interface LlmRequest {
  messages: Array<{ role: string; content: string }>;
  tools?: ToolSet;
  maxSteps?: number;
  /** Ativar web search nativo (só quando a mensagem precisa de pesquisa) */
  webSearch?: boolean;
}

export interface LlmToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface LlmToolResult {
  toolCallId: string;
  toolName: string;
  result: unknown;
}

export interface LlmResponse {
  content: string;
  model: string;
  provider: string;
  toolCalls?: LlmToolCall[];
  toolResults?: LlmToolResult[];
}

export interface LlmProvider {
  readonly name: string;
  readonly type: 'local' | 'cloud';

  generate(request: LlmRequest): Promise<LlmResponse>;
  generateStream(request: LlmRequest, onToken: LlmStreamCallback): Promise<LlmResponse>;
  isAvailable(): Promise<boolean>;
}
