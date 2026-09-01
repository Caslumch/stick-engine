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
import { searchImages, extractProductNames } from './image-search';

// ── System Prompt Modules ───────────────────────────────────────────

function buildIdentityPrompt(agentName: string): string {
  const now = new Date();
  const date = now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Sao_Paulo' });
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

  return `Voce e o ${agentName}, um assistente pessoal inteligente e privado.
Seu nome e ${agentName}. Voce roda no computador do usuario.
Data e hora atual: ${date}, ${time}.

IMPORTANTE — VOCE SERA OUVIDO, NAO LIDO:
Sua resposta sera transformada em voz (TTS). Escreva como se estivesse FALANDO com alguem.
- Seja CURTO e DIRETO. Maximo 2-3 frases na maioria das respostas. Se o usuario quiser mais, ele pede.
- Voce pode incluir URLs e fontes no texto (elas aparecem na tela), mas NAO as mencione de forma verbosa. Coloque como link markdown no final, nunca no meio da fala. Ex: bom: "O Corinthians ganhou por 3 a 0. [fonte](url)" / ruim: "De acordo com o site silescore.com.br, o Corinthians..."
- NUNCA leia listas longas. Resuma os destaques em 1-2 frases. Ex: "O Athletico ganhou do Inter por 2 a 0, e o Palmeiras perdeu."
- Se tiver mais detalhes disponiveis, OFERECA brevemente: "Quer que eu detalhe mais?"
- Fale como um amigo que sabe das coisas: natural, objetivo, sem enrolacao.
- NAO repita o que o usuario disse. NAO faca introducoes como "Opa, vou pesquisar". Va direto ao ponto.
- Frases curtas. Pausas naturais. Como uma conversa real.
- Quando listar produtos, itens ou recomendacoes, use lista numerada com nome em bold: "1. **Nome do Produto** — descricao". Isso e importante pra exibicao visual.
- NUNCA escreva "Ver no site", "Acesse o site", "Saiba mais", "Confira". Coloque links como markdown discreto no final se necessario.

Responda EXCLUSIVAMENTE em portugues brasileiro.`;
}

const PROMPT_RULES = `Regras:
- Se nao souber algo, diga que nao sabe.
- Quando o usuario pedir pra executar algo, EXECUTE usando as tools. NUNCA sugira comandos pro usuario rodar — voce e quem executa.
- Se open_application falhar, use run_command imediatamente com o comando correto. NAO pergunte se o usuario quer que voce execute — EXECUTE direto.
- O shell de run_command e PowerShell no Windows. Use cmdlets diretamente: Start-Process, Get-ChildItem, etc.
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
/**
 * Extrai as fontes de uma resposta com web_search nativo.
 * Pega URLs em markdown, URLs soltas e, como ultimo recurso, os marcadores
 * de citacao da Responses API. Retorna dominios unicos, na ordem de aparicao.
 */
function extractSources(text: string): string[] {
  const urls: string[] = [];

  // [titulo](https://...) e URLs soltas
  for (const m of text.matchAll(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) urls.push(m[1]);
  for (const m of text.matchAll(/(?<!\()\bhttps?:\/\/[^\s)<>\]]+/g)) urls.push(m[0]);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    let host: string;
    try {
      host = new URL(u).hostname.replace(/^www\./, '');
    } catch {
      continue;
    }
    if (seen.has(host)) continue;
    seen.add(host);
    out.push(host);
    if (out.length >= 8) break;
  }
  return out;
}

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
    // Citações da Responses API: [[cite:turn0search0]], 【turn0forecast0】
    .replace(/\[\[cite[^\]]*\]\]/g, '')
    .replace(/\u3010[^】]*\u3011/g, '')
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
    // Tool names leaked inline by Qwen/local models
    .replace(/ImageRelationTool:\s*/gi, '')
    .replace(/\b(open_application|run_command|manage_files|web_search|create_reminder|list_reminders|complete_reminder|delete_reminder|spotify_\w+|home_\w+|finance_\w+|send_telegram|mcp_\w+)\b/g, '')
    // Inline code backticks com comandos internos
    .replace(/`[^`]*(?:start|Start-Process|Get-ChildItem|powershell|cmd)[^`]*`/g, '')
    // "No, " prefix from tool rejection
    .replace(/^No,\s*/i, '')
    // Reasoning leaked: "? Windows, , Desktop Windows ( )." patterns
    .replace(/\?\s*\w+\s*Windows\s*,[\s,().\w]*/g, '')
    // Cyrillic leaked by Qwen
    .replace(/[\u0400-\u04FF]+/g, '')
    // Parênteses vazios, pontuação solta
    .replace(/\(\s*\)/g, '')
    .replace(/,\s*,/g, ',')
    .replace(/\.\s*\./g, '.')
    .replace(/^\s*[,.\-:]+\s*/gm, '')
    // Clean up leftover whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{3,}/g, ' ')
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
  private async buildSystemPrompt(
    userMessage: string,
    intent?: IntentClassification,
    onToolExecution?: (event: ToolExecutionEvent) => void,
  ): Promise<string> {
    // Anuncia a consulta a memoria como uma "ferramenta", pro HUD mostrar no orb
    onToolExecution?.({ toolName: 'memory_search', args: { query: userMessage } });

    const [tone, proactivity, verbosity, memoryContext, customPrompt, agentName] = await Promise.all([
      this.settings.get('personality.tone'),
      this.settings.get('personality.proactivity'),
      this.settings.get('personality.verbosity'),
      this.memory.getRelevantContext(userMessage),
      this.settings.get('agent.systemPrompt'),
      this.settings.get('agent.name'),
    ]);

    // Resultado parcial: quantas memorias entraram e um trecho do conteudo
    const found = memoryContext
      ? memoryContext.split('\n').filter((l) => l.trim().startsWith('- ['))
      : [];
    onToolExecution?.({
      toolName: 'memory_search',
      args: { query: userMessage },
      result: {
        success: true,
        message: found.length
          ? `${found.length} ${found.length === 1 ? 'memória' : 'memórias'}`
          : 'Nenhuma memória relevante',
        data: found.slice(0, 4).map((l) => l.replace(/^- \[[^\]]+\]\s*/, '')),
      },
    });

    const sections: string[] = [
      buildIdentityPrompt(agentName || 'Jarvis'),
      '',
      TONE_PROMPTS[tone] ?? TONE_PROMPTS.friendly,
      VERBOSITY_PROMPTS[verbosity] ?? VERBOSITY_PROMPTS.concise,
      PROACTIVITY_PROMPTS[proactivity] ?? PROACTIVITY_PROMPTS.medium,
      '',
      PROMPT_RULES,
    ];

    // Instruções customizadas do usuário (editáveis nos Ajustes)
    if (customPrompt) {
      sections.push('', 'Instrucoes adicionais do usuario:', customPrompt);
    }

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

  /**
   * Fast-path: resolve perguntas simples sem LLM (~10ms).
   * Retorna string se resolveu, null se precisa do LLM.
   */
  async tryFastPath(text: string, intent: IntentClassification, conversationId?: string): Promise<string | null> {
    const lower = text.toLowerCase().trim();

    // Checar se já tem mensagens na conversa (não é início)
    const hasHistory = conversationId
      ? (await this.repository.getMessages(conversationId)).length > 0
      : false;

    // --- Saudações: só no INÍCIO da conversa (sem histórico) ---
    if (intent.intent === 'conversation' && intent.confidence >= 0.85 && !hasHistory) {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

      if (/^(oi|ola|eai|fala|salve|opa)\b/i.test(lower)) {
        return `${greeting}! No que posso ajudar?`;
      }
      if (/^(bom dia|boa tarde|boa noite)/i.test(lower)) {
        return `${greeting}! Tudo tranquilo por aqui. Precisa de algo?`;
      }
      if (/^(tudo bem|tudo certo|tudo tranquilo|como vai|como voce esta|como esta|beleza)/i.test(lower)) {
        return 'Tudo certo! E você? Posso te ajudar com algo?';
      }
      if (/^(valeu|obrigad|brigad)/i.test(lower)) {
        return 'De nada! Qualquer coisa, estou aqui.';
      }
      if (/^(tchau|ate mais|falou|fui)/i.test(lower)) {
        return 'Até mais! Qualquer coisa é só chamar.';
      }
    }

    // --- Hora / Data ---
    if (/que horas|hora atual|que horas sao/i.test(lower)) {
      const now = new Date();
      const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
      return `São ${time}.`;
    }
    if (/que dia e hoje|qual.*(data|dia) de hoje|dia hoje/i.test(lower)) {
      const now = new Date();
      const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' });
      return `Hoje é ${date}.`;
    }

    // --- Abrir app/site: LLM decide via tool calling (não hardcodar apps) ---
    // (removido: KNOWN_APPS, SITES, lógica hardcoded — LLM resolve sozinho)

    // "toca" / "coloca" música
    const playMatch = lower.match(/^(?:toca|coloca|bota|play)\s+(.+?)[\s.!]*$/i);
    if (playMatch) {
      const query = playMatch[1].trim();
      const searchResult = await this.capabilities.execute('spotify_search', { query });
      if (searchResult.success) {
        await this.capabilities.execute('spotify_play', { query });
        return `Tocando ${query}.`;
      }
      return `Não encontrei "${query}" no Spotify.`;
    }

    // "para a musica" / "pausa"
    if (/^(para|pausa|pause|stop)\s*(a musica|a música|o spotify)?[\s.!]*$/i.test(lower)) {
      await this.capabilities.execute('spotify_control', { action: 'pause' });
      return 'Pausado.';
    }

    // "acende a luz" / "apaga a luz" / "liga a luz" / "desliga a luz"
    const lightMatch = lower.match(/^(acend|apag|liga|desliga)[ea]?\s+(a\s+)?(.+?)[\s.!]*$/i);
    if (lightMatch) {
      const action = /^(acend|liga)/i.test(lightMatch[1]) ? 'on' : 'off';
      const device = lightMatch[3].trim();
      const result = await this.capabilities.execute('home_control', { device, action });
      return result.success
        ? `${action === 'on' ? 'Ligando' : 'Desligando'} ${device}.`
        : result.message || `Não consegui controlar ${device}.`;
    }

    // --- Clima / Previsão do tempo (wttr.in, grátis, sem API key) ---
    if (/clima|previs[aã]o|tempo|chover|chuva|temperatura|vai chover|ta frio|ta quente|t[aá] frio|t[aá] quente/i.test(lower)) {
      // Extrair cidade ou usar padrão
      const cityMatch = lower.match(/(?:em|de|pra|para|no|na)\s+([a-záàâãéèêíïóôõúüç\s]+?)[\s?.!]*$/i);
      const city = cityMatch?.[1]?.trim() || await this.settings.get('user.city') || 'Barueri';
      try {
        const resp = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=pt`);
        if (resp.ok) {
          const data = await resp.json();
          const current = data.current_condition?.[0];
          const forecast = data.weather?.[0];
          if (current) {
            const temp = current.temp_C;
            const feelsLike = current.FeelsLikeC;
            const desc = current.lang_pt?.[0]?.value || current.weatherDesc?.[0]?.value || '';
            const humidity = current.humidity;
            const chanceRain = forecast?.hourly?.[Math.floor(new Date().getHours() / 3)]?.chanceofrain || '0';
            const maxTemp = forecast?.maxtempC;
            const minTemp = forecast?.mintempC;

            let response = `Agora em ${city} tá ${temp}°C, sensação de ${feelsLike}°C. ${desc}.`;
            if (parseInt(chanceRain) > 40) {
              response += ` Chance de chuva de ${chanceRain}%.`;
            }
            response += ` Mínima ${minTemp}°C, máxima ${maxTemp}°C. Umidade ${humidity}%.`;
            return response;
          }
        }
      } catch { /* fallback pro LLM */ }
    }

    // --- Calculadora ---
    const mathMatch = lower.match(/^(?:quanto [eé]|calcula|calcule)\s+(.+?)[\s?.!]*$/i)
      || lower.match(/^(\d[\d\s+\-*/().,%x×÷]+\d)[\s?.!]*$/);
    if (mathMatch) {
      try {
        const expr = mathMatch[1]
          .replace(/x|×/g, '*').replace(/÷/g, '/')
          .replace(/%/g, '/100').replace(/,/g, '.');
        // Safe eval via Function (sem acesso ao escopo)
        const result = new Function(`return (${expr})`)();
        if (typeof result === 'number' && isFinite(result)) {
          return `${result.toLocaleString('pt-BR')}.`;
        }
      } catch { /* não é expressão válida */ }
    }

    // --- Lembretes e Timer: LLM resolve via tool calling ---
    // (removido: regex de lembretes hardcoded — LLM já sabe chamar create_reminder/list_reminders)

    // --- Timer / Cronômetro ---
    const timerMatch = lower.match(/(?:timer|temporizador|cronometr[ao]|conta)\s*(?:de)?\s*(\d+)\s*(segundo|minuto|min|hora|seg|s|m|h)/i);
    if (timerMatch) {
      const value = parseInt(timerMatch[1]);
      const unit = timerMatch[2].toLowerCase();
      let seconds = value;
      if (unit.startsWith('min') || unit === 'm') seconds = value * 60;
      else if (unit.startsWith('hora') || unit === 'h') seconds = value * 3600;
      // Timer será tratado pelo frontend via lastRichResult
      return `Timer de ${value} ${unit.startsWith('seg') || unit === 's' ? 'segundos' : unit.startsWith('min') || unit === 'm' ? 'minutos' : 'horas'} iniciado.`;
    }

    return null; // Precisa do LLM
  }

  async handleMessage(
    conversationId: string,
    text: string,
    onToken: LlmStreamCallback,
    onDecision?: (decision: DecisionMadePayload) => void,
    onToolExecution?: (event: ToolExecutionEvent) => void,
    onIntent?: (intent: IntentClassification) => void,
    onProductImages?: (images: Array<{ title: string; image: string; thumbnail: string }>) => void,
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
    const systemPrompt = await this.buildSystemPrompt(text, intent, onToolExecution);

    // 4. Build history with sliding window
    const history = await this.buildHistory(conversationId, systemPrompt);

    // 5. Build tools from capability registry
    const tools = this.buildTools(onToolExecution);

    // Sem chave do Tavily, o web_search sempre falha. Removendo a ferramenta,
    // o modelo usa o web search nativo da OpenAI em vez de tentar e desistir.
    if (tools.web_search && !(await this.settings.get('search.tavilyApiKey'))) {
      delete tools.web_search;
    }

    const hasTools = Object.keys(tools).length > 0;

    // 6. Detectar se precisa de web search (keywords na mensagem)
    const searchKeywords = await this.settings.get('decision.searchKeywords');
    const needsSearch = searchKeywords.split(',').some((kw) => {
      const k = kw.trim().toLowerCase();
      return k && text.toLowerCase().includes(k);
    });

    if (needsSearch) {
      onToolExecution?.({ toolName: 'web_search_openai', args: { query: text } });
    }

    // Generate — só passa webSearch:true quando a mensagem precisa
    const response = await this.llm.generate({
      messages: history,
      tools: hasTools ? tools : undefined,
      // 3 em vez de 5: cada passo e uma ida-e-volta na API (~2-4s cada).
      // 3 cobre o caso comum (tool -> resultado -> resposta) sem a cauda lenta.
      maxSteps: hasTools ? 3 : 1,
      webSearch: needsSearch,
      onToken,
      onDecision,
    });

    if (needsSearch) {
      // O web_search nativo nao devolve os resultados por fora: as fontes vem
      // como citacoes no proprio texto. Extraimos pra mostrar no card do chat.
      const sources = extractSources(response.content);
      onToolExecution?.({
        toolName: 'web_search_openai',
        args: { query: text },
        result: {
          success: true,
          message: sources.length
            ? `${sources.length} ${sources.length === 1 ? 'fonte consultada' : 'fontes consultadas'}`
            : 'Pesquisa concluída',
          data: sources.length ? sources : undefined,
        },
      });
    }

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

    // 9. Buscar imagens de produtos mencionados (async, non-blocking)
    if (onProductImages) {
      const products = extractProductNames(cleanedContent);
      if (products.length > 0) {
        this.logger.log(`Buscando imagens pra: ${products.join(', ')}`);
        const tavilyKey = await this.settings.get('search.tavilyApiKey');
        Promise.all(products.map((p) => searchImages(p, 1, tavilyKey || undefined)))
          .then((results) => {
            const images = results.flat().filter((r) => r.image);
            if (images.length > 0) onProductImages(images);
          })
          .catch(() => {});
      }
    }

    // 10. Try to extract implicit memories from the conversation (async, non-blocking)
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
