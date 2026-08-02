import { Injectable, Logger } from '@nestjs/common';
import { MemoryRepository, CreateMemoryData } from './memory.repository';
import { EmbeddingService } from './embedding.service';
import type { MemoryType, MemorySource } from '@jarvis/shared';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly repository: MemoryRepository,
    private readonly embedding: EmbeddingService,
  ) {}

  async save(content: string, type: MemoryType, source: MemorySource = 'explicit') {
    const vector = await this.embedding.embed(content);

    const data: CreateMemoryData = {
      type,
      content,
      source,
      embedding: vector ?? undefined,
    };

    const memory = await this.repository.create(data);
    this.logger.log(`Memory saved: [${type}] ${content.slice(0, 50)}...`);
    return memory;
  }

  async list(type?: MemoryType) {
    return this.repository.findAll(type);
  }

  async get(id: string) {
    return this.repository.findById(id);
  }

  async update(id: string, content: string) {
    const vector = await this.embedding.embed(content);
    return this.repository.update(id, content, vector ?? undefined);
  }

  async delete(id: string) {
    await this.repository.delete(id);
  }

  async search(query: string, limit = 5): Promise<any[]> {
    const vector = await this.embedding.embed(query);
    if (!vector) {
      this.logger.warn('Could not generate embedding for search, returning empty');
      return [];
    }
    return this.repository.searchByEmbedding(vector, limit);
  }

  /**
   * Busca memorias relevantes para injetar no system prompt.
   * Retorna um bloco de texto formatado ou string vazia.
   */
  async getRelevantContext(userMessage: string): Promise<string> {
    const memories = await this.search(userMessage, 5);
    if (memories.length === 0) return '';

    const lines = memories.map(
      (m: any) => `- [${m.type}] ${m.content}`,
    );

    return [
      '',
      'Memorias relevantes sobre o usuario:',
      ...lines,
      '',
    ].join('\n');
  }

  /**
   * Detecta e extrai memorias de uma mensagem do usuario.
   * Patterns: "lembra que...", "anota que...", "memoriza que..."
   */
  extractExplicitMemory(text: string): { content: string; type: MemoryType } | null {
    const patterns = [
      /(?:lembra|anota|memoriza|guarda|salva)\s+(?:que|isso[:\s])\s*(.+)/i,
      /(?:lembra|anota|memoriza|guarda|salva)\s+(?:a[ií]|isto)[:\s]\s*(.+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const content = match[1].trim();
        const type = this.inferMemoryType(content);
        return { content, type };
      }
    }

    return null;
  }

  private inferMemoryType(content: string): MemoryType {
    const lower = content.toLowerCase();

    if (/(?:gosto|prefiro|favorit|prefere|odeio|detesto)/i.test(lower)) return 'preference';
    if (/(?:meu pai|minha mae|meu irmao|minha irma|meu amigo|minha namorad|meu chefe)/i.test(lower)) return 'person';
    if (/(?:projeto|repo|sistema|app|codigo|branch)/i.test(lower)) return 'project';
    if (/(?:alexa|google home|lampada|sensor|camera|tomada)/i.test(lower)) return 'device';
    if (/(?:sempre|todo dia|toda noite|rotina|costume|habito)/i.test(lower)) return 'habit';

    return 'fact';
  }
}
