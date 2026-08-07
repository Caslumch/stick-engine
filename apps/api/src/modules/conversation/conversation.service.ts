import { Injectable, Logger } from '@nestjs/common';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { ConversationRepository } from './conversation.repository';
import { LlmService } from '../llm/llm.service';
import { MemoryService } from '../memory/memory.service';
import { CapabilityRegistryService } from '../capabilities/capability-registry.service';
import { SettingsService } from '../settings/settings.service';
import type { LlmStreamCallback } from '../../common/interfaces';
import type { DecisionMadePayload, IntentClassification, IntentType } from '@jarvis/shared';

// ── System Prompt Modules ───────────────────────────────────────────

function buildIdentityPrompt(): string {
  const now = new Date();
  const date = now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Sao_Paulo' });
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

  return `Voce e o Jarvis, um assistente pessoal inteligente e privado.
Seu nome e Jarvis. Voce roda no computador do usuario.
Data e hora atual: ${date}, ${time}.

IMPORTANTE — VOCE SERA OUVIDO, NAO LIDO:
Sua resposta sera transformada em voz (TTS). Escreva como se estivesse FALANDO com alguem.
- Seja CURTO e DIRETO. Maximo 2-3 frases na maioria das respostas. Se o usuario quiser mais, ele pede.
- NUNCA mencione URLs, links, fontes ou "de acordo com o site X". Omita completamente.
- NUNCA leia listas longas. Resuma os destaques em 1-2 frases. Ex: "O Athletico ganhou do Inter por 2 a 0, e o Palmeiras perdeu."
- Se tiver mais detalhes disponiveis, OFERECA brevemente: "Quer que eu detalhe mais?"
- Fale como um amigo que sabe das coisas: natural, objetivo, sem enrolacao.
- NAO repita o que o usuario disse. NAO faca introducoes como "Opa, vou pesquisar". Va direto ao ponto.
- Frases curtas. Pausas naturais. Como uma conversa real.

Responda EXCLUSIVAMENTE em portugues brasileiro.`;
}

const PROMPT_RULES = `Regras:
- Se nao souber algo, diga que nao sabe.
- Quando o usuario pedir pra executar algo no computador, use as tools disponiveis.
- Sempre explique o que voce fez apos executar uma tool.
- NAO tente executar tools quando o usuario so esta conversando ou cumprimentando.
- Quando o usuario pedir pra voce lembrar de algo, confirme que voce guardou na memoria.
- Use as memorias sobre o usuario para personalizar suas respostas.
- Quando uma tool retornar dados em ingles ou JSON, INTERPRETE e TRADUZA os dados para portugues brasileiro na sua resposta. Nao despeje JSON cru de tools na resposta — resuma os dados de forma legivel. EXCECAO: se o usuario pedir explicitamente um JSON, codigo ou exemplo tecnico, forneca normalmente.
- NUNCA escreva em chines, tailandes, japones, coreano, arabe ou qualquer alfabeto nao-latino.
- LEMBRE-SE: toda resposta DEVE ser em portugues brasileiro, sem excecao. Se voce perceber que esta escrevendo em outro idioma, PARE e recomece em portugues.`;

const TONE_PROMPTS: Record<string, string> = {
  friendly: 'Use um tom amigavel e natural. Voce entende girias e cumprimentos brasileiros como "eai", "fala", "opa", "beleza", "e ai mano", "salve", "bom dia". Responda de forma natural e amigavel.',
  formal: 'Use um tom profissional e educado. Evite girias e linguagem coloquial. Seja cortez e preciso.',
  casual: 'Use um tom bem descontraido, como um amigo proximo. Use girias, emojis leves e humor quando fizer sentido.',
};

const PROACTIVITY_PROMPTS: Record<string, string> = {
  low: 'Apenas responda o que foi perguntado. Nao faca sugestoes a menos que pedido.',
  medium: 'Alem de responder, faca sugestoes breves quando relevante, mas sem insistir.',
  high: 'Seja proativo: sugira proximos passos, antecipe necessidades e ofereca alternativas. Se perceber algo que pode ajudar o usuario, mencione.',
};

const VERBOSITY_PROMPTS: Record<string, string> = {
  concise: 'Seja direto e conciso. Respostas curtas e objetivas.',
  balanced: 'Equilibre brevidade e detalhe. Explique o necessario sem ser prolixo.',
  detailed: 'Explique com detalhes e contexto. Inclua exemplos quando util.',
};

/**
 * Strip raw tool-call artifacts that local models (Qwen, Llama) leak into text.
 * e.g. _icall_ {"name":"...", "arguments":...} _icio_:*cal*)_fcio ***!
 *      <gorith tool_name {"arg": "val"}>
 */
function cleanToolArtifacts(text: string): string {
  return text
    // Strip CJK, Thai, Arabic, Devanagari and other non-Latin script blocks that Qwen hallucinates
    .replace(/[\u0E00-\u0E7F]+/g, '')   // Thai
    .replace(/[\u4E00-\u9FFF]+/g, '')   // CJK Unified
    .replace(/[\u3400-\u4DBF]+/g, '')   // CJK Extension A
    .replace(/[\u3000-\u303F]+/g, '')   // CJK Symbols
    .replace(/[\u0600-\u06FF]+/g, '')   // Arabic
    .replace(/[\u0900-\u097F]+/g, '')   // Devanagari
    .replace(/[\uAC00-\uD7AF]+/g, '')   // Korean
    .replace(/[\u3040-\u30FF]+/g, '')   // Japanese Hiragana/Katakana
    // Qwen _icall_ ... _fcio pattern
    .replace(/_icall_\s*\{[^}]*\}\s*/g, '')
    .replace(/_icio_[^!]*\*{0,3}!?\s*/g, '')
    .replace(/_fcio\s*\*{0,3}!?\s*/g, '')
    // Llama <gorith ...> pattern
    .replace(/<gorith[^>]*>/g, '')
    // Tool call XML tags leaked by various models
    .replace(/<\/?tool_call>/gi, '')
    .replace(/<\/?function_call>/gi, '')
    .replace(/HeaderCode:\s*/gi, '')
    // Generic JSON tool call leak: {"name": "...", "arguments": ...}
    .replace(/\{"name":\s*"[^"]*",\s*"(arguments|parameters)":\s*\{[^}]*\}\}\s*/g, '')
    // Clean up leftover whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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
    private readonly settings: SettingsService,
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
   * Build a modular system prompt:
   * identity + personality (tone/verbosity/proactivity) + rules + capabilities + memories
   */
  private async buildSystemPrompt(userMessage: string, intent?: IntentClassification): Promise<string> {
    const [tone, proactivity, verbosity, memoryContext] = await Promise.all([
      this.settings.get('personality.tone'),
      this.settings.get('personality.proactivity'),
      this.settings.get('personality.verbosity'),
      this.memory.getRelevantContext(userMessage),
    ]);

    const sections: string[] = [
      buildIdentityPrompt(),
      '',
      TONE_PROMPTS[tone] ?? TONE_PROMPTS.friendly,
      VERBOSITY_PROMPTS[verbosity] ?? VERBOSITY_PROMPTS.concise,
      PROACTIVITY_PROMPTS[proactivity] ?? PROACTIVITY_PROMPTS.medium,
      '',
      PROMPT_RULES,
    ];

    // Intent context helps the LLM understand user goal
    if (intent) {
      const intentHints: Record<IntentType, string> = {
        information: 'O usuario esta pedindo informacao. Responda de forma informativa.',
        action: 'O usuario quer que voce execute uma acao. Use as tools disponiveis se aplicavel.',
        conversation: 'O usuario esta conversando casualmente. Seja natural e amigavel.',
        confirmation: 'O usuario esta confirmando ou negando algo. Seja breve.',
        memory: 'O usuario quer que voce memorize algo. Confirme que guardou.',
      };
      sections.push('', `Contexto da intencao: ${intentHints[intent.intent]}`);
    }

    // Capabilities available
    const tools = this.capabilities.getAllTools();
    if (tools.length > 0) {
      const toolList = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
      sections.push('', 'Ferramentas disponiveis:', toolList);
      sections.push('IMPORTANTE: Os resultados das ferramentas podem vir em ingles ou JSON. Voce DEVE interpretar esses dados e responder ao usuario em portugues brasileiro de forma natural e resumida.');
    }

    // Memories
    if (memoryContext) {
      sections.push(memoryContext);
    }

    return sections.join('\n');
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

  /**
   * Fast intent classification via heuristics (no LLM call = zero latency).
   */
  classifyIntent(text: string): IntentClassification {
    const lower = text.toLowerCase().trim();

    // Memory intent
    if (/^(lembra|anota|memoriza|guarda|salva)\s/i.test(lower)) {
      return { intent: 'memory', confidence: 0.95 };
    }

    // Confirmation
    if (/^(sim|nao|s|n|ok|pode|confirma|cancela|isso|exato|isso mesmo|nega|claro|com certeza)\s*[.!]?$/i.test(lower)) {
      return { intent: 'confirmation', confidence: 0.9 };
    }

    // Action intent — commands
    if (/^(abre|abra|execut|rod[ae]|cri[ae]|delet|apag|instal|fecha|liga|desliga|acend|apaga|toca|para|paus)/i.test(lower)) {
      return { intent: 'action', confidence: 0.85 };
    }

    // Information intent — questions
    if (/^(o que|qual|quais|como|quando|onde|por ?que|quem|quanto|quantos|quantas|me (diz|fala|conta|explica))/i.test(lower) || lower.endsWith('?')) {
      return { intent: 'information', confidence: 0.8 };
    }

    // Conversation — greetings, casual
    if (/^(oi|ola|eai|fala|salve|bom dia|boa tarde|boa noite|beleza|opa|tudo bem|valeu|obrigad|tchau|ate mais|falou)/i.test(lower)) {
      return { intent: 'conversation', confidence: 0.85 };
    }

    // Default: information (most messages are questions)
    return { intent: 'information', confidence: 0.5 };
  }

  async handleMessage(
    conversationId: string,
    text: string,
    onToken: LlmStreamCallback,
    onDecision?: (decision: DecisionMadePayload) => void,
    onToolExecution?: (event: ToolExecutionEvent) => void,
    onIntent?: (intent: IntentClassification) => void,
  ) {
    // 0. Classify intent (zero-latency heuristic)
    const intent = this.classifyIntent(text);
    onIntent?.(intent);
    this.logger.log(`Intent: ${intent.intent} (${intent.confidence})`);

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

    // 3. Build system prompt with relevant memories + intent context
    const systemPrompt = await this.buildSystemPrompt(text, intent);

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

    // 7. Persist assistant message (clean tool-call artifacts from local models)
    const cleanedContent = cleanToolArtifacts(response.content);
    const saved = await this.repository.addMessage(conversationId, {
      role: 'assistant',
      content: cleanedContent,
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
