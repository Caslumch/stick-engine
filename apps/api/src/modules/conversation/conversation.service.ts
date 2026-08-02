import { Injectable, Logger } from '@nestjs/common';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { ConversationRepository } from './conversation.repository';
import { LlmService } from '../llm/llm.service';
import { MemoryService } from '../memory/memory.service';
import { CapabilityRegistryService } from '../capabilities/capability-registry.service';
import type { LlmStreamCallback } from '../../common/interfaces';
import type { DecisionMadePayload } from '@jarvis/shared';

const SYSTEM_PROMPT_BASE = `Voce e o Jarvis, um assistente pessoal inteligente e privado.

REGRA ABSOLUTA: Responda EXCLUSIVAMENTE em portugues brasileiro. NUNCA use chines, ingles ou qualquer outro idioma.

Regras:
- Seja direto e conciso.
- Use um tom amigavel e natural. Voce entende girias e cumprimentos brasileiros como "eai", "fala", "opa", "beleza", "e ai mano", "salve", "bom dia", etc. Responda de forma natural e amigavel.
- Seu nome e Jarvis, nao Qwen, nao ChatGPT, nao outro.
- Voce roda localmente no computador do usuario.
- Se nao souber algo, diga que nao sabe.
- Quando o usuario pedir pra executar algo no computador, use as tools disponiveis.
- Sempre explique o que voce fez apos executar uma tool.
- NAO tente executar tools quando o usuario so esta conversando ou cumprimentando.
- Quando o usuario pedir pra voce lembrar de algo, confirme que voce guardou na memoria.
- Use as memorias sobre o usuario para personalizar suas respostas.
- LEMBRE-SE: toda resposta em portugues brasileiro, sem excecao.`;

/** Max messages to keep in the prompt (excluding summary) */
const SLIDING_WINDOW_SIZE = 30;
/** Summarize when total messages exceed this */
const SUMMARIZE_THRESHOLD = 40;

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
    private readonly memory: MemoryService,
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
   */
  private buildTools(onToolExecution?: (event: ToolExecutionEvent) => void): ToolSet {
    const registeredTools = this.capabilities.getAllTools();
    if (registeredTools.length === 0) return {};

    const aiTools: ToolSet = {};

    for (const t of registeredTools) {
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

  /**
   * Build the system prompt with relevant memories injected.
   */
  private async buildSystemPrompt(userMessage: string): Promise<string> {
    const memoryContext = await this.memory.getRelevantContext(userMessage);
    return SYSTEM_PROMPT_BASE + memoryContext;
  }

  /**
   * Build message history with sliding window.
   * If there are more messages than the threshold, summarize the older ones.
   */
  private async buildHistory(
    conversationId: string,
    systemPrompt: string,
  ): Promise<Array<{ role: string; content: string }>> {
    const conversation = await this.repository.findById(conversationId);
    const allMessages = conversation?.messages ?? [];

    // Check if we need to summarize
    if (allMessages.length > SUMMARIZE_THRESHOLD && !conversation?.summary) {
      this.summarizeOldMessages(conversationId, allMessages);
    }

    const history: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // If we have a summary, prepend it
    if (conversation?.summary) {
      history.push({
        role: 'system',
        content: `Resumo da conversa anterior:\n${conversation.summary}`,
      });
    }

    // Take the last N messages (sliding window)
    const recentMessages = allMessages.length > SLIDING_WINDOW_SIZE
      ? allMessages.slice(-SLIDING_WINDOW_SIZE)
      : allMessages;

    for (const m of recentMessages) {
      history.push({ role: m.role, content: m.content });
    }

    return history;
  }

  async handleMessage(
    conversationId: string,
    text: string,
    onToken: LlmStreamCallback,
    onDecision?: (decision: DecisionMadePayload) => void,
    onToolExecution?: (event: ToolExecutionEvent) => void,
  ) {
    // 1. Check for explicit memory save ("Jarvis, lembra que...")
    const explicitMemory = this.memory.extractExplicitMemory(text);
    if (explicitMemory) {
      await this.memory.save(explicitMemory.content, explicitMemory.type, 'explicit');
      this.logger.log(`Explicit memory saved: [${explicitMemory.type}] ${explicitMemory.content}`);
    }

    // 2. Persist user message
    await this.repository.addMessage(conversationId, {
      role: 'user',
      content: text,
    });

    // 3. Build system prompt with relevant memories
    const systemPrompt = await this.buildSystemPrompt(text);

    // 4. Build history with sliding window
    const history = await this.buildHistory(conversationId, systemPrompt);

    // 5. Build tools from capability registry
    const tools = this.buildTools(onToolExecution);
    const hasTools = Object.keys(tools).length > 0;

    // 6. Generate response via LLM (streamed, with tool calling)
    const response = await this.llm.generate({
      messages: history,
      tools: hasTools ? tools : undefined,
      maxSteps: hasTools ? 5 : 1,
      onToken,
      onDecision,
    });

    // 7. Persist assistant message
    const saved = await this.repository.addMessage(conversationId, {
      role: 'assistant',
      content: response.content,
      provider: response.provider,
      model: response.model,
      toolCalls: response.toolCalls as any,
    });

    // 8. Auto-generate title after first user message
    const allMessages = await this.repository.getMessages(conversationId);
    if (allMessages.length <= 2) {
      this.generateTitle(conversationId, text);
    }

    // 9. Try to extract implicit memories from the conversation (async, non-blocking)
    this.extractImplicitMemories(text, response.content);

    return saved;
  }

  /**
   * Summarize older messages and store the summary in the conversation.
   * Runs async — does not block the response.
   */
  private async summarizeOldMessages(
    conversationId: string,
    messages: Array<{ role: string; content: string }>,
  ) {
    try {
      const oldMessages = messages.slice(0, -SLIDING_WINDOW_SIZE);
      const transcript = oldMessages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n');

      const result = await this.llm.generate({
        messages: [
          {
            role: 'system',
            content: 'Resuma a conversa abaixo em um paragrafo conciso em portugues. Capture os pontos principais, decisoes tomadas e informacoes importantes. Responda APENAS o resumo.',
          },
          { role: 'user', content: transcript },
        ],
      });

      const summary = result.content.trim();
      if (summary) {
        await this.repository.updateSummary(conversationId, summary);
        this.logger.log(`Conversation ${conversationId} summarized (${oldMessages.length} messages)`);
      }
    } catch (error) {
      this.logger.warn(`Failed to summarize conversation: ${error}`);
    }
  }

  /**
   * Try to extract implicit facts from the conversation.
   * e.g., "Eu uso VS Code" → save preference.
   * Runs async, non-blocking.
   */
  private async extractImplicitMemories(userMessage: string, assistantResponse: string) {
    try {
      const result = await this.llm.generate({
        messages: [
          {
            role: 'system',
            content: `Analise a mensagem do usuario e identifique fatos pessoais que valham ser lembrados.
Tipos validos: preference, person, project, device, habit, fact.

Responda APENAS em JSON array. Se nao houver nada relevante, responda [].
Formato: [{"type": "...", "content": "..."}]

Exemplos de fatos relevantes:
- "Eu uso VS Code" → {"type": "preference", "content": "Usa VS Code como editor"}
- "Meu irmao se chama Pedro" → {"type": "person", "content": "Irmao se chama Pedro"}
- "Acordo todo dia as 7h" → {"type": "habit", "content": "Acorda as 7h todo dia"}

NAO extraia fatos triviais, perguntas ou comandos. Apenas informacoes pessoais duradouras.`,
          },
          { role: 'user', content: `Mensagem do usuario: "${userMessage}"` },
        ],
      });

      const text = result.content.trim();
      // Extract JSON array from response
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return;

      const facts = JSON.parse(match[0]);
      for (const fact of facts) {
        if (fact.type && fact.content) {
          await this.memory.save(fact.content, fact.type, 'inferred');
        }
      }
    } catch {
      // Non-critical — silent fail
    }
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
