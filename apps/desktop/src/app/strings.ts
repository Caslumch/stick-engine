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

/** Avisos do fluxo de voz que nao correspondem a um estado do agente. */
export const VOICE_NOTICES = {
  notUnderstood: 'Não captei nada. Tente falar de novo.',
  listenTimeout: 'Não ouvi nada — microfone desligado.',
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

export const TOOL_LABELS: Record<string, string> = {
  memory_search: 'Consultando memória',
  web_search: 'Pesquisando na web',
  finance_summary: 'Consultando finanças',
  finance_by_category: 'Analisando categorias',
  finance_transactions: 'Buscando transações',
  finance_monthly: 'Carregando histórico',
  create_reminder: 'Criando lembrete',
  list_reminders: 'Listando lembretes',
  complete_reminder: 'Completando lembrete',
  delete_reminder: 'Deletando lembrete',
  send_telegram: 'Enviando no Telegram',
  home_list_devices: 'Listando dispositivos',
  home_control: 'Controlando dispositivo',
  home_scene: 'Ativando cena',
  spotify_search: 'Pesquisando música',
  spotify_play: 'Tocando música',
  spotify_control: 'Controlando player',
  spotify_now_playing: 'Verificando reprodução',
  open_application: 'Abrindo aplicativo',
  run_command: 'Executando comando',
  manage_files: 'Gerenciando arquivos',
  _stt_transcribe: 'Transcrevendo áudio',
  _stt_sending: 'Enviando mensagem',
  web_search_openai: 'Pesquisando na internet',
  _response: 'Resposta',
}
