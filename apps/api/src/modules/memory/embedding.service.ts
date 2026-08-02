import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly ollamaUrl: string;

  constructor(
    config: ConfigService,
    private readonly settings: SettingsService,
  ) {
    this.ollamaUrl = config.get<string>('jarvis.ollama.url', 'http://localhost:11434');
  }

  async embed(text: string): Promise<number[] | null> {
    try {
      return await this.embedViaOllama(text);
    } catch (error) {
      this.logger.warn(`Ollama embedding failed, trying OpenAI: ${error}`);
    }

    try {
      return await this.embedViaOpenAI(text);
    } catch (error) {
      this.logger.error(`All embedding providers failed: ${error}`);
      return null;
    }
  }

  async embedBatch(texts: string[]): Promise<(number[] | null)[]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }

  private async embedViaOllama(text: string): Promise<number[]> {
    const model = await this.settings.get('embedding.ollama.model') || 'nomic-embed-text';

    const res = await fetch(`${this.ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: text }),
    });

    if (!res.ok) {
      throw new Error(`Ollama embed failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.embeddings[0];
  }

  private async embedViaOpenAI(text: string): Promise<number[]> {
    const apiKey = await this.settings.get('llm.openai.apiKey');
    if (!apiKey) throw new Error('No OpenAI API key configured');

    const model = await this.settings.get('embedding.openai.model') || 'text-embedding-3-small';

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
        dimensions: 768,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI embed failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.data[0].embedding;
  }
}
