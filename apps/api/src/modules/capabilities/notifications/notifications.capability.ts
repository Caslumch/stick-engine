import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Capability, CapabilityResult, Tool } from '../../../common/interfaces';
import { CapabilityRegistryService } from '../capability-registry.service';
import { SettingsService } from '../../settings/settings.service';

const TELEGRAM_API = 'https://api.telegram.org/bot';

@Injectable()
export class NotificationsCapability implements Capability, OnModuleInit {
  private readonly logger = new Logger(NotificationsCapability.name);

  readonly name = 'notifications';
  readonly description = 'Envia mensagens e notificacoes via Telegram.';

  readonly tools: Tool[] = [
    {
      name: 'send_telegram',
      description:
        'Envia uma mensagem no Telegram. Use quando o usuario pedir "manda no Telegram", "envia mensagem", "notifica", etc.',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Texto da mensagem para enviar',
          },
          chat_id: {
            type: 'string',
            description: 'Chat ID do Telegram (opcional — usa o padrao configurado nas settings)',
          },
        },
        required: ['message'],
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
    if (toolName === 'send_telegram') {
      return this.sendTelegram(
        params.message as string,
        params.chat_id as string | undefined,
      );
    }
    return { success: false, message: `Tool desconhecida: ${toolName}` };
  }

  private async sendTelegram(message: string, chatId?: string): Promise<CapabilityResult> {
    const botToken = await this.settings.get('notifications.telegramBotToken');
    const defaultChatId = await this.settings.get('notifications.telegramChatId');
    const targetChatId = chatId || defaultChatId;

    if (!botToken) {
      return {
        success: false,
        message: 'Token do bot Telegram nao configurado. Va em Settings > Integrations.',
      };
    }

    if (!targetChatId) {
      return {
        success: false,
        message: 'Chat ID do Telegram nao configurado. Va em Settings > Integrations.',
      };
    }

    try {
      const resp = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        this.logger.error(`Telegram error: ${resp.status} - ${body}`);
        return { success: false, message: `Erro ao enviar Telegram: ${resp.status}` };
      }

      this.logger.log(`Telegram sent to ${targetChatId}: "${message.slice(0, 50)}..."`);

      return {
        success: true,
        message: `Mensagem enviada no Telegram com sucesso.`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Erro ao enviar Telegram: ${msg}` };
    }
  }
}
