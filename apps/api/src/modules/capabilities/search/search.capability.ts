import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Capability, CapabilityResult, Tool } from '../../../common/interfaces';
import { CapabilityRegistryService } from '../capability-registry.service';
import { SettingsService } from '../../settings/settings.service';

const TAVILY_API_URL = 'https://api.tavily.com/search';

@Injectable()
export class SearchCapability implements Capability, OnModuleInit {
  private readonly logger = new Logger(SearchCapability.name);

  readonly name = 'search';
  readonly description = 'Pesquisa na web e retorna resultados resumidos.';

  readonly tools: Tool[] = [
    {
      name: 'web_search',
      description:
        'Pesquisa na internet. Use quando o usuario perguntar sobre noticias, eventos atuais, informacoes que voce nao sabe, ou pedir explicitamente para pesquisar.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Termo de busca (em portugues ou ingles)',
          },
          max_results: {
            type: 'number',
            description: 'Numero maximo de resultados (padrao: 5, max: 10)',
          },
        },
        required: ['query'],
      },
    },
  ];

  constructor(
    private readonly registry: CapabilityRegistryService,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(toolName: string, params: Record<string, unknown>): Promise<CapabilityResult> {
    if (toolName === 'web_search') {
      return this.search(
        params.query as string,
        (params.max_results as number) || 5,
      );
    }
    return { success: false, message: `Tool desconhecida: ${toolName}` };
  }

  private async search(query: string, maxResults: number): Promise<CapabilityResult> {
    const apiKey = await this.settings.get('search.tavilyApiKey');

    if (!apiKey) {
      return {
        success: false,
        message: 'API key do Tavily nao configurada. Va em Settings e configure search.tavilyApiKey.',
      };
    }

    try {
      const resp = await fetch(TAVILY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: Math.min(maxResults, 10),
          search_depth: 'basic',
          include_answer: true,
        }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        this.logger.error(`Tavily error: ${resp.status} - ${body}`);
        return { success: false, message: `Erro na pesquisa: ${resp.status}` };
      }

      const data = await resp.json();

      const results = (data.results || []).map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.content?.slice(0, 300),
      }));

      const summary = data.answer || results.map((r: any) => `- ${r.title}: ${r.snippet}`).join('\n');

      this.logger.log(`Search: "${query}" → ${results.length} results`);

      return {
        success: true,
        message: summary,
        data: { results, answer: data.answer },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Search failed: ${msg}`);
      return { success: false, message: `Erro na pesquisa: ${msg}` };
    }
  }
}
