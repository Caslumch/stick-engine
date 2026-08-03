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
  'llm.ollama.model': 'llama3.1',
  'llm.ollama.url': 'http://localhost:11434',
  'llm.openai.model': 'gpt-4o-mini',
  'llm.preferLocal': 'true',
  'decision.tokenThreshold': '2000',
  'decision.searchKeywords': 'pesquisa,pesquise,busca,busque,procura,procure,google,search,o que aconteceu,noticia,noticias,hoje,agora,atual,atualmente',

  // Personality
  'personality.tone': 'friendly',       // friendly | formal | casual
  'personality.proactivity': 'medium',  // low | medium | high
  'personality.verbosity': 'concise',   // concise | balanced | detailed

  // Search
  'search.tavilyApiKey': '',
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
};

// Keys that should be masked when sent to the frontend
const SENSITIVE_KEYS = ['llm.openai.apiKey', 'search.tavilyApiKey', 'notifications.telegramBotToken', 'finance.password', 'spotify.clientSecret', 'home.tuyaAccessSecret'];

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
