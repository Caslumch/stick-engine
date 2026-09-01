import { Injectable, Logger } from '@nestjs/common';
import { SettingsRepository } from './settings.repository';

export interface JarvisSettings {
  // LLM
  'llm.ollama.model': string;
  'llm.ollama.url': string;
  'llm.openai.apiKey': string;
  'llm.openai.model': string;
  'llm.preferLocal': string;

  // Decision Engine
  'decision.tokenThreshold': string;
  'decision.searchKeywords': string;

  [key: string]: string;
}

const DEFAULTS: Record<string, string> = {
  'llm.ollama.model': 'qwen3:8b',
  'llm.ollama.url': 'http://localhost:11434',
  'llm.openai.model': 'gpt-4o',
  'llm.preferLocal': 'true',
  'decision.tokenThreshold': '2000',
  'decision.searchKeywords': 'pesquisa,pesquise,busca,busque,procura,procure,google,search,o que aconteceu,noticia,noticias,hoje,agora,atual,atualmente,imagem,imagens,foto,fotos,mostra,mostrar,preço,preços,preco,precos,comprar,onde comprar,quanto custa,melhores,top,recomend,ranking,tempo,clima,previsao,previsão,temperatura,chuva,amanha,amanhã,cotacao,cotação,dolar,dólar,euro,bitcoin,jogo,placar,resultado,quando,onde fica,horario,horário',

  // Agent
  'agent.name': 'Jarvis',

  // User — vazios de proposito: preenchidos pela UI ou aprendidos na conversa
  'user.name': '',
  'user.city': 'Barueri',

  // Personality
  'personality.tone': 'friendly',       // friendly | formal | casual
  'personality.proactivity': 'medium',  // low | medium | high
  'personality.verbosity': 'concise',   // concise | balanced | detailed

  // Search
  'search.tavilyApiKey': process.env.TAVILY_API_KEY || '',
  'openai.webSearch': 'true',

  // Finance (LemonFin)
  'finance.apiUrl': 'https://lemonfin-api.onrender.com',
  'finance.email': '',
  'finance.password': '',

  // Smart Home (Tuya)
  'home.tuyaAccessId': '',
  'home.tuyaAccessSecret': '',
  'home.tuyaRegion': 'us',
  'home.tuyaUid': '',

  // Notifications
  'notifications.telegramBotToken': '',
  'notifications.telegramChatId': '',

  // Spotify
  'spotify.clientId': '',
  'spotify.clientSecret': '',
  // Preenchidos pelo OAuth (/api/spotify/login) — nao editar a mao
  'spotify.userAccessToken': '',
  'spotify.refreshToken': '',
  'spotify.tokenExpiresAt': '',
  // Player embutido (Web Playback SDK)
  'spotify.player.enabled': 'false',
  'spotify.player.autoplayUri': '',
  'spotify.player.duckOnSpeech': 'true',
};

// Keys that should be masked when sent to the frontend
// 'openai.apiKey' e a chave que a tela de Ajustes grava hoje; 'llm.openai.apiKey'
// e a da tela antiga. As duas precisam ser mascaradas ao enviar pro cliente.
const SENSITIVE_KEYS = ['openai.apiKey', 'llm.openai.apiKey', 'search.tavilyApiKey', 'notifications.telegramBotToken', 'finance.password', 'spotify.clientSecret', 'spotify.userAccessToken', 'spotify.refreshToken', 'home.tuyaAccessSecret'];

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly repository: SettingsRepository) {}

  async get(key: string): Promise<string> {
    const value = await this.repository.get(key);
    return value ?? DEFAULTS[key] ?? '';
  }

  async getAll(): Promise<Record<string, string>> {
    const stored = await this.repository.getAll();
    const merged = { ...DEFAULTS, ...stored };
    return merged;
  }

  async getAllSafe(): Promise<Record<string, string>> {
    const all = await this.getAll();
    const safe = { ...all };
    for (const key of SENSITIVE_KEYS) {
      if (safe[key]) {
        safe[key] = safe[key].slice(0, 7) + '...' + safe[key].slice(-4);
      }
    }
    return safe;
  }

  async set(key: string, value: string): Promise<void> {
    await this.repository.set(key, value);
    this.logger.log(`Setting updated: ${SENSITIVE_KEYS.includes(key) ? key + ' = [masked]' : key + ' = ' + value}`);
  }
}
