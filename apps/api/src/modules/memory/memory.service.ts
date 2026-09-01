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
    // Duas fontes: memorias de identidade (sempre presentes) e busca semantica.
    // So a busca semantica falha em perguntas curtas — "onde eu moro?" pontua
    // ~0.41 contra "Mora em Barueri", entao fatos basicos sumiam do contexto.
    const [semantic, core] = await Promise.all([
      this.search(userMessage, 5).catch(() => [] as any[]),
      this.getCoreMemories().catch(() => [] as any[]),
    ]);

    const seen = new Set<string>();
    const all: any[] = [];
    for (const m of [...core, ...semantic]) {
      const key = (m.content || '').toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      all.push(m);
    }

    if (all.length === 0) return '';

    return [
      '',
      'Memorias sobre o usuario:',
      ...all.map((m) => `- [${m.type}] ${m.content}`),
      '',
    ].join('\n');
  }

  /**
   * Memorias de identidade — nome, onde mora, preferencias fortes.
   * Sempre entram no contexto, independente da similaridade da pergunta.
   */
  private async getCoreMemories(): Promise<any[]> {
    const people = await this.repository.findAll('person' as MemoryType);
    const facts = await this.repository.findAll('fact' as MemoryType);
    const isIdentity = (c: string) =>
      /\b(nome|chamo|chama|mora|moro|vive|vivo|idade|anos|trabalh|profiss)\b/i.test(c);

    return [...people, ...facts]
      .filter((m: any) => isIdentity(m.content || ''))
      .slice(0, 8);
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
