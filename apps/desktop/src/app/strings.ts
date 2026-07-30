import type { JarvisState } from '@jarvis/shared'

/** Strings da UI centralizadas. PT-BR conforme decisão do projeto. */

export const STATE_LABELS: Record<JarvisState, string> = {
  idle: 'Disponível',
  listening: 'Ouvindo',
  thinking: 'Pensando',
  executing: 'Executando',
  speaking: 'Falando',
  error: 'Erro',
  offline: 'Offline',
}

export const VOICE_PROMPTS: Record<JarvisState, string> = {
  idle: 'Aperte o mic ou pressione espaço para falar.',
  listening: '',
  thinking: 'Processando...',
  executing: 'Executando ferramenta...',
  speaking: '',
  error: 'Algo deu errado. Tente novamente.',
  offline: 'Sem conexão com o agente.',
}

export const AGENT_NAME = 'STICK'

export const NAV = {
  voice: 'Voz',
  chat: 'Chat',
  settings: 'Ajustes',
}

export const DOCK = {
  cancel: 'Cancelar',
  interrupt: 'Interromper',
  retry: 'Tentar de novo',
  reconnect: 'Reconectar',
}
