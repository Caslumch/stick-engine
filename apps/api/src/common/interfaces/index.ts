export {
  LLM_PROVIDERS,
  LlmProvider,
  LlmRequest,
  LlmResponse,
  LlmStreamCallback,
  LlmToolCall,
  LlmToolResult,
} from './llm-provider.interface';

export interface CapabilityResult {
  success: boolean;
  data?: unknown;
  message?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface Capability {
  name: string;
  description: string;
  tools: Tool[];
  execute(toolName: string, params: Record<string, unknown>): Promise<CapabilityResult>;
}
