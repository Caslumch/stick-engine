import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import type { LlmProvider } from '../../common/interfaces';

export interface DecisionResult {
  provider: string;
  reason: string;
}

@Injectable()
export class DecisionService {
  private readonly logger = new Logger(DecisionService.name);

  constructor(private readonly settings: SettingsService) {}

  async chooseProvider(
    message: string,
    providers: Map<string, LlmProvider>,
  ): Promise<string> {
    const ollamaAvailable = await this.checkProvider('ollama', providers);
    const preferLocal = (await this.settings.get('llm.preferLocal')) === 'true';

    // Rule 1: If local is not available, use cloud
    if (!ollamaAvailable) {
      this.log(message, 'openai', 'local-unavailable');
      return 'openai';
    }

    // If user doesn't prefer local, go cloud
    if (!preferLocal) {
      this.log(message, 'openai', 'prefer-cloud');
      return 'openai';
    }

    // Rule 2: If message seems to need search/web AND preferLocal is off, use cloud
    // Quando preferLocal está ativo, o modelo local usa Tavily pra pesquisar
    if (!preferLocal && await this.requiresSearch(message)) {
      this.log(message, 'openai', 'search-required');
      return 'openai';
    }

    // Rule 3: If message is very long (complex context), use cloud
    const threshold = parseInt(await this.settings.get('decision.tokenThreshold'), 10) || 2000;
    if (message.length > threshold) {
      this.log(message, 'openai', 'context-too-large');
      return 'openai';
    }

    // Default: use local
    this.log(message, 'ollama', 'default-local');
    return 'ollama';
  }

  private async requiresSearch(message: string): Promise<boolean> {
    const keywordsStr = await this.settings.get('decision.searchKeywords');
    const keywords = keywordsStr.split(',').map((k) => k.trim()).filter(Boolean);
    const lower = message.toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
  }

  private async checkProvider(
    name: string,
    providers: Map<string, LlmProvider>,
  ): Promise<boolean> {
    const provider = providers.get(name);
    if (!provider) return false;
    try {
      return await provider.isAvailable();
    } catch {
      return false;
    }
  }

  private log(input: string, provider: string, reason: string) {
    this.logger.log(`Decision: ${provider} (${reason}) — "${input.slice(0, 60)}"`);
  }
}
