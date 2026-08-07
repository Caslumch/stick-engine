import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ToolSet } from 'ai';
import { DecisionService } from '../decision/decision.service';
import type { LlmProvider, LlmRequest, LlmResponse, LlmStreamCallback } from '../../common/interfaces';
import { LLM_PROVIDERS } from '../../common/interfaces';
import type { DecisionMadePayload } from '@jarvis/shared';

export interface GenerateOptions {
  messages: Array<{ role: string; content: string }>;
  tools?: ToolSet;
  maxSteps?: number;
  webSearch?: boolean;
  onToken?: LlmStreamCallback;
  onDecision?: (decision: DecisionMadePayload) => void;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly providers: Map<string, LlmProvider>;

  constructor(
    private readonly decision: DecisionService,
    @Inject(LLM_PROVIDERS) providers: LlmProvider[],
  ) {
    this.providers = new Map(providers.map((p) => [p.name, p]));
    this.logger.log(`Registered providers: ${providers.map((p) => p.name).join(', ')}`);
  }

  async generate(opts: GenerateOptions): Promise<LlmResponse>;
  /** @deprecated Use options object */
  async generate(
    messages: Array<{ role: string; content: string }>,
    onToken?: LlmStreamCallback,
    onDecision?: (decision: DecisionMadePayload) => void,
  ): Promise<LlmResponse>;
  async generate(
    messagesOrOpts: Array<{ role: string; content: string }> | GenerateOptions,
    onToken?: LlmStreamCallback,
    onDecision?: (decision: DecisionMadePayload) => void,
  ): Promise<LlmResponse> {
    // Normalize to options object
    const opts: GenerateOptions = Array.isArray(messagesOrOpts)
      ? { messages: messagesOrOpts, onToken, onDecision }
      : messagesOrOpts;

    const lastMessage = opts.messages[opts.messages.length - 1]?.content ?? '';
    const chosenName = await this.decision.chooseProvider(lastMessage, this.providers);

    // Build fallback order: chosen first, then all others
    const order = [chosenName, ...Array.from(this.providers.keys()).filter((n) => n !== chosenName)];

    for (const name of order) {
      const provider = this.providers.get(name);
      if (!provider) continue;

      const available = await provider.isAvailable();
      if (!available) {
        this.logger.warn(`Provider "${name}" unavailable, trying next...`);
        continue;
      }

      try {
        this.logger.log(`Using ${provider.name} (${provider.type})`);

        opts.onDecision?.({
          provider: provider.type,
          model: name,
          reason: name === chosenName ? 'chosen' : 'fallback',
        });

        const request: LlmRequest = {
          messages: opts.messages,
          tools: opts.tools,
          maxSteps: opts.maxSteps,
          webSearch: opts.webSearch,
        };

        if (opts.onToken) {
          return await provider.generateStream(request, opts.onToken);
        }
        return await provider.generate(request);
      } catch (error) {
        this.logger.error(`Provider "${name}" failed: ${error}`);
        continue;
      }
    }

    throw new Error('Nenhum provedor de IA disponivel. Verifique o Ollama ou configure uma API key.');
  }
}
