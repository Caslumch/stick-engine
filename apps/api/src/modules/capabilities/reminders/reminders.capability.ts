import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Capability, CapabilityResult, Tool } from '../../../common/interfaces';
import { CapabilityRegistryService } from '../capability-registry.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class RemindersCapability implements Capability, OnModuleInit {
  private readonly logger = new Logger(RemindersCapability.name);
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  /** Callback set by the gateway to emit notifications */
  onNotification?: (reminder: { id: string; title: string; description?: string }) => void;

  readonly name = 'reminders';
  readonly description = 'Cria, lista e gerencia lembretes com horario agendado.';

  readonly tools: Tool[] = [
    {
      name: 'create_reminder',
      description:
        'Cria um lembrete. O usuario pode dizer "me lembra de X amanha as 9h", "daqui a 30 minutos me avisa de Y", etc. Converta para uma data/hora ISO.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Titulo curto do lembrete',
          },
          description: {
            type: 'string',
            description: 'Descricao detalhada (opcional)',
          },
          due_at: {
            type: 'string',
            description: 'Data/hora no formato ISO 8601 (ex: 2026-08-03T09:00:00). Converta expressoes como "amanha as 9h", "daqui a 1 hora", etc.',
          },
        },
        required: ['title', 'due_at'],
      },
    },
    {
      name: 'list_reminders',
      description: 'Lista lembretes pendentes do usuario.',
      parameters: {
        type: 'object',
        properties: {
          include_completed: {
            type: 'boolean',
            description: 'Incluir lembretes ja concluidos (padrao: false)',
          },
        },
      },
    },
    {
      name: 'complete_reminder',
      description: 'Marca um lembrete como concluido.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'ID do lembrete',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'delete_reminder',
      description: 'Deleta um lembrete.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'ID do lembrete',
          },
        },
        required: ['id'],
      },
    },
  ];

  constructor(
    private readonly registry: CapabilityRegistryService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
    this.startNotificationChecker();
  }

  async execute(toolName: string, params: Record<string, unknown>): Promise<CapabilityResult> {
    switch (toolName) {
      case 'create_reminder': {
        // Aceitar qualquer nome de param que o LLM inventar
        const allValues = Object.values(params).filter((v) => typeof v === 'string' && v.trim()) as string[];
        const title = (params.title ?? params.task ?? params.name ?? params.text ?? params.note ?? params.reminder) as string
          || allValues.find((v) => v.length > 2 && !/^\d{4}-/.test(v)) || 'Lembrete';
        const dueAtRaw = (params.due_at ?? params.dueAt ?? params.time ?? params.date ?? params.datetime ?? params.date_time ?? params.when ?? params.scheduled_at) as string
          || allValues.find((v) => /^\d{4}-/.test(v)); // qualquer string ISO
        return this.create(title, dueAtRaw, (params.description ?? params.desc ?? params.details ?? params.note) as string | undefined);
      }
      case 'list_reminders':
        return this.list(params.include_completed as boolean);
      case 'complete_reminder':
        return this.complete(params.id as string);
      case 'delete_reminder':
        return this.deleteReminder(params.id as string);
      default:
        return { success: false, message: `Tool desconhecida: ${toolName}` };
    }
  }

  private async create(title: string, dueAt?: string, description?: string): Promise<CapabilityResult> {
    let date: Date;
    if (dueAt) {
      date = new Date(dueAt);
      if (isNaN(date.getTime())) {
        // Tentar interpretar "daqui X minutos" se não é ISO
        date = new Date(Date.now() + 5 * 60000); // fallback: 5 min
        this.logger.warn(`Data "${dueAt}" inválida, usando +5min como fallback`);
      }
    } else {
      // Sem data → daqui 5 minutos como padrão
      date = new Date(Date.now() + 5 * 60000);
    }

    const reminder = await this.prisma.reminder.create({
      data: { title, description, dueAt: date },
    });

    const formatted = date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    this.logger.log(`Reminder created: "${title}" at ${formatted}`);

    return {
      success: true,
      message: `Lembrete criado: "${title}" para ${formatted}.`,
      data: { id: reminder.id, title, dueAt: formatted },
    };
  }

  private async list(includeCompleted = false): Promise<CapabilityResult> {
    const reminders = await this.prisma.reminder.findMany({
      where: includeCompleted ? {} : { completed: false },
      orderBy: { dueAt: 'asc' },
    });

    if (reminders.length === 0) {
      return { success: true, message: 'Nenhum lembrete pendente.' };
    }

    const list = reminders.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      dueAt: r.dueAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      completed: r.completed,
    }));

    const text = list
      .map((r) => `- ${r.completed ? '✓' : '○'} ${r.title} (${r.dueAt})`)
      .join('\n');

    return {
      success: true,
      message: `${list.length} lembrete(s):\n${text}`,
      data: list,
    };
  }

  private async complete(id: string): Promise<CapabilityResult> {
    try {
      const reminder = await this.prisma.reminder.update({
        where: { id },
        data: { completed: true },
      });
      return { success: true, message: `Lembrete "${reminder.title}" concluido.` };
    } catch {
      return { success: false, message: `Lembrete com ID "${id}" nao encontrado.` };
    }
  }

  private async deleteReminder(id: string): Promise<CapabilityResult> {
    try {
      const reminder = await this.prisma.reminder.delete({ where: { id } });
      return { success: true, message: `Lembrete "${reminder.title}" deletado.` };
    } catch {
      return { success: false, message: `Lembrete com ID "${id}" nao encontrado.` };
    }
  }

  /**
   * Check every 30s for reminders that are due and haven't been notified yet.
   */
  private startNotificationChecker() {
    this.checkInterval = setInterval(async () => {
      try {
        const due = await this.prisma.reminder.findMany({
          where: {
            completed: false,
            notified: false,
            dueAt: { lte: new Date() },
          },
        });

        for (const reminder of due) {
          this.logger.log(`Reminder due: "${reminder.title}"`);

          await this.prisma.reminder.update({
            where: { id: reminder.id },
            data: { notified: true },
          });

          this.onNotification?.({
            id: reminder.id,
            title: reminder.title,
            description: reminder.description ?? undefined,
          });
        }
      } catch (error) {
        this.logger.warn(`Notification check failed: ${error}`);
      }
    }, 30_000);
  }
}
