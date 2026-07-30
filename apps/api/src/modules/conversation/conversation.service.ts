import { Injectable, Logger } from '@nestjs/common';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { ConversationRepository } from './conversation.repository';
import { LlmService } from '../llm/llm.service';
import { CapabilityRegistryService } from '../capabilities/capability-registry.service';
import type { LlmStreamCallback } from '../../common/interfaces';
import type { DecisionMadePayload } from '@jarvis/shared';

const SYSTEM_PROMPT = `Voce e o Jarvis, um assistente pessoal inteligente e privado.

Regras:
- Sempre responda em portugues brasileiro.
- Seja direto e conciso.
- Use um tom amigavel mas profissional.
- Seu nome e Jarvis, nao Qwen, nao ChatGPT, nao outro.
- Voce roda localmente no computador do usuario.
- Se nao souber algo, diga que nao sabe.
- Quando o usuario pedir pra executar algo no computador, use as tools disponiveis.
- Sempre explique o que voce fez apos executar uma tool.`;

export interface ToolExecutionEvent {
  toolName: string;
  args: Record<string, unknown>;
  result?: { success: boolean; message?: string; data?: unknown };
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly repository: ConversationRepository,
    private readonly llm: LlmService,
    private readonly capabilities: CapabilityRegistryService,
  ) {}

  async createConversation(title?: string) {
    return this.repository.create(title);
  }

  async listConversations(page?: number, limit?: number) {
    return this.repository.findAll(page, limit);
  }

  async getConversation(id: string) {
    return this.repository.findById(id);
  }

  async deleteConversation(id: string) {
    return this.repository.delete(id);
  }

  /**
   * Build AI SDK tools from the CapabilityRegistry.
   * Each registered Tool becomes a CoreTool with execute() wired to the registry.
   */
  private buildTools(onToolExecution?: (event: ToolExecutionEvent) => void): ToolSet {
    const registeredTools = this.capabilities.getAllTools();
    if (registeredTools.length === 0) return {};

    const aiTools: ToolSet = {};

    for (const t of registeredTools) {
      // Build zod schema from JSON schema properties
      const schemaObj: Record<string, z.ZodTypeAny> = {};
      const props = t.parameters.properties;
      for (const [key, prop] of Object.entries(props)) {
        const p = prop as { type?: string; description?: string; enum?: string[] };
        let field: z.ZodTypeAny;
        if (p.enum) {
          field = z.enum(p.enum as [string, ...string[]]);
        } else if (p.type === 'number') {
          field = z.number();
        } else if (p.type === 'boolean') {
          field = z.boolean();
        } else {
          field = z.string();
        }
        if (p.description) field = field.describe(p.description);
        if (!t.parameters.required?.includes(key)) {
          field = field.optional();
        }
        schemaObj[key] = field;
      }

      const schema = z.object(schemaObj);
      (aiTools as any)[t.name] = {
        description: t.description,
        parameters: schema,
        execute: async (args: Record<string, unknown>) => {
          this.logger.log(`Executing tool: ${t.name} with args: ${JSON.stringify(args)}`);
          onToolExecution?.({ toolName: t.name, args });

          const result = await this.capabilities.execute(t.name, args);

          this.logger.log(`Tool result: ${JSON.stringify(result)}`);
          onToolExecution?.({ toolName: t.name, args, result });

          return result;
        },
      };
    }

    return aiTools;
  }

  async handleMessage(
    conversationId: string,
    text: string,
    onToken: LlmStreamCallback,
    onDecision?: (decision: DecisionMadePayload) => void,
    onToolExecution?: (event: ToolExecutionEvent) => void,
  ) {
    // 1. Persist user message
    await this.repository.addMessage(conversationId, {
      role: 'user',
      content: text,
    });

    // 2. Load conversation history with system prompt
    const messages = await this.repository.getMessages(conversationId);
    const history = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // 3. Build tools from capability registry
    const tools = this.buildTools(onToolExecution);
    const hasTools = Object.keys(tools).length > 0;

    // 4. Generate response via LLM (streamed, with tool calling)
    const response = await this.llm.generate({
      messages: history,
      tools: hasTools ? tools : undefined,
      maxSteps: hasTools ? 5 : 1,
      onToken,
      onDecision,
    });

    // 5. Persist assistant message
    const saved = await this.repository.addMessage(conversationId, {
      role: 'assistant',
      content: response.content,
      provider: response.provider,
      model: response.model,
      toolCalls: response.toolCalls as any,
    });

    // 6. Auto-generate title after first user message
    const messageCount = messages.length;
    if (messageCount === 1) {
      this.generateTitle(conversationId, text);
    }

    return saved;
  }

  private async generateTitle(conversationId: string, firstMessage: string) {
    try {
      const result = await this.llm.generate({
        messages: [
          {
            role: 'system',
            content: 'Gere um titulo curto (maximo 5 palavras) para uma conversa que comeca com a mensagem abaixo. Responda APENAS o titulo, sem aspas, sem pontuacao final.',
          },
          { role: 'user', content: firstMessage },
        ],
      });
      const title = result.content.trim().slice(0, 60);
      if (title) {
        await this.repository.updateTitle(conversationId, title);
      }
    } catch {
      // Non-critical
    }
  }
}
