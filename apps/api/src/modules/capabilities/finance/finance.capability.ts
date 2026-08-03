import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Capability, CapabilityResult, Tool } from '../../../common/interfaces';
import { CapabilityRegistryService } from '../capability-registry.service';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class FinanceCapability implements Capability, OnModuleInit {
  private readonly logger = new Logger(FinanceCapability.name);
  private accessToken: string | null = null;

  readonly name = 'finance';
  readonly description = 'Consulta financas pessoais: saldo, gastos, transacoes, categorias.';

  readonly tools: Tool[] = [
    {
      name: 'finance_summary',
      description:
        'Mostra resumo financeiro do mes: total de receitas, despesas e saldo. Use quando o usuario perguntar "quanto gastei", "como estao minhas financas", "qual meu saldo".',
      parameters: {
        type: 'object',
        properties: {
          month: {
            type: 'string',
            description: 'Mes no formato YYYY-MM (opcional, padrao: mes atual)',
          },
        },
      },
    },
    {
      name: 'finance_by_category',
      description:
        'Mostra gastos agrupados por categoria. Use quando o usuario perguntar "onde estou gastando mais", "gastos por categoria".',
      parameters: {
        type: 'object',
        properties: {
          month: {
            type: 'string',
            description: 'Mes no formato YYYY-MM (opcional, padrao: mes atual)',
          },
        },
      },
    },
    {
      name: 'finance_transactions',
      description:
        'Lista transacoes recentes. Use quando o usuario quiser ver transacoes, ultimos gastos, ou historico.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Numero de transacoes (padrao: 10, max: 30)',
          },
          type: {
            type: 'string',
            description: 'Filtrar por tipo: INCOME ou EXPENSE (opcional)',
          },
        },
      },
    },
    {
      name: 'finance_monthly',
      description:
        'Mostra evolucao mensal dos gastos/receitas nos ultimos meses. Use pra comparacoes e tendencias.',
      parameters: {
        type: 'object',
        properties: {
          months: {
            type: 'number',
            description: 'Numero de meses pra trás (padrao: 6)',
          },
        },
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
    switch (toolName) {
      case 'finance_summary':
        return this.getSummary(params.month as string | undefined);
      case 'finance_by_category':
        return this.getByCategory(params.month as string | undefined);
      case 'finance_transactions':
        return this.getTransactions(
          (params.limit as number) || 10,
          params.type as string | undefined,
        );
      case 'finance_monthly':
        return this.getMonthly((params.months as number) || 6);
      default:
        return { success: false, message: `Tool desconhecida: ${toolName}` };
    }
  }

  private async getApiUrl(): Promise<string> {
    return await this.settings.get('finance.apiUrl') || 'http://localhost:3001';
  }

  private async authenticate(): Promise<string | null> {
    if (this.accessToken) return this.accessToken;

    const [apiUrl, email, password] = await Promise.all([
      this.getApiUrl(),
      this.settings.get('finance.email'),
      this.settings.get('finance.password'),
    ]);

    this.logger.log(`Auth attempt: email=${email ? email.slice(0, 3) + '***' : 'EMPTY'}, password=${password ? '***' : 'EMPTY'}, url=${apiUrl}`);

    if (!email || !password) {
      this.logger.warn('Missing email or password');
      return null;
    }

    try {
      const resp = await fetch(`${apiUrl}/auth/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        this.logger.error(`LemonFin auth failed: ${resp.status} - ${body}`);
        return null;
      }

      const data = await resp.json();
      const jwt = data.token ?? data.accessToken;
      this.logger.log(`LemonFin auth success: token=${jwt ? 'OK' : 'MISSING'}, status=${data.status}`);
      this.accessToken = jwt;

      // Re-auth after 50 minutes (token likely expires in 60)
      setTimeout(() => { this.accessToken = null; }, 50 * 60 * 1000);

      return this.accessToken;
    } catch (error) {
      this.logger.error(`LemonFin auth error: ${error}`);
      return null;
    }
  }

  private async apiCall(path: string, query?: Record<string, string>): Promise<CapabilityResult> {
    const token = await this.authenticate();
    if (!token) {
      return {
        success: false,
        message: 'Nao foi possivel autenticar no LemonFin. Configure email e senha em Settings > Integrations.',
      };
    }

    const apiUrl = await this.getApiUrl();
    const url = new URL(path, apiUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v) url.searchParams.set(k, v);
      }
    }

    try {
      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.status === 401) {
        this.accessToken = null;
        return { success: false, message: 'Sessao expirada. Tente novamente.' };
      }

      if (!resp.ok) {
        return { success: false, message: `Erro na API financeira: ${resp.status}` };
      }

      return { success: true, message: '', data: await resp.json() };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Erro ao acessar financas: ${msg}` };
    }
  }

  private currentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private async getSummary(month?: string): Promise<CapabilityResult> {
    const m = month || this.currentMonth();
    const [start, end] = this.monthRange(m);

    const result = await this.apiCall('/transactions/summary', {
      startDate: start,
      endDate: end,
    });

    if (!result.success) return result;

    const data = result.data as any;
    const income = data.INCOME ?? data.income ?? 0;
    const expense = data.EXPENSE ?? data.expense ?? 0;
    const balance = income - Math.abs(expense);

    return {
      success: true,
      message: `Resumo de ${m}:\n- Receitas: R$ ${Number(income).toFixed(2)}\n- Despesas: R$ ${Math.abs(Number(expense)).toFixed(2)}\n- Saldo: R$ ${balance.toFixed(2)}`,
      data: { month: m, income, expense, balance },
    };
  }

  private async getByCategory(month?: string): Promise<CapabilityResult> {
    const m = month || this.currentMonth();
    const [start, end] = this.monthRange(m);

    const result = await this.apiCall('/transactions/by-category', {
      startDate: start,
      endDate: end,
    });

    if (!result.success) return result;

    const categories = result.data as any[];
    if (!categories || categories.length === 0) {
      return { success: true, message: `Nenhum gasto categorizado em ${m}.` };
    }

    const text = categories
      .sort((a: any, b: any) => Math.abs(b.total ?? b._sum?.amount ?? 0) - Math.abs(a.total ?? a._sum?.amount ?? 0))
      .map((c: any) => {
        const name = c.name ?? c.category ?? 'Sem categoria';
        const total = Math.abs(c.total ?? c._sum?.amount ?? 0);
        return `- ${name}: R$ ${total.toFixed(2)}`;
      })
      .join('\n');

    return {
      success: true,
      message: `Gastos por categoria em ${m}:\n${text}`,
      data: categories,
    };
  }

  private async getTransactions(limit: number, type?: string): Promise<CapabilityResult> {
    const query: Record<string, string> = {
      limit: String(Math.min(limit, 30)),
      sort: 'date',
      order: 'desc',
    };
    if (type) query.type = type;

    const result = await this.apiCall('/transactions', query);
    if (!result.success) return result;

    const data = result.data as any;
    const transactions = Array.isArray(data) ? data : data.data ?? data.transactions ?? [];

    if (transactions.length === 0) {
      return { success: true, message: 'Nenhuma transacao encontrada.' };
    }

    const text = transactions.slice(0, limit).map((t: any) => {
      const amount = Number(t.amount);
      const sign = t.type === 'INCOME' ? '+' : '-';
      const date = new Date(t.date).toLocaleDateString('pt-BR');
      return `- ${date} ${sign}R$ ${Math.abs(amount).toFixed(2)} — ${t.description}`;
    }).join('\n');

    return {
      success: true,
      message: `Ultimas ${transactions.length} transacoes:\n${text}`,
      data: transactions,
    };
  }

  private async getMonthly(months: number): Promise<CapabilityResult> {
    const result = await this.apiCall('/transactions/monthly');
    if (!result.success) return result;

    const data = result.data as any[];
    if (!data || data.length === 0) {
      return { success: true, message: 'Sem dados mensais disponiveis.' };
    }

    const recent = data.slice(-months);
    const text = recent.map((m: any) => {
      const month = m.month ?? m.period;
      const income = Number(m.income ?? m.INCOME ?? 0);
      const expense = Math.abs(Number(m.expense ?? m.EXPENSE ?? 0));
      return `- ${month}: +R$ ${income.toFixed(2)} / -R$ ${expense.toFixed(2)}`;
    }).join('\n');

    return {
      success: true,
      message: `Evolucao mensal (ultimos ${recent.length} meses):\n${text}`,
      data: recent,
    };
  }

  private monthRange(month: string): [string, string] {
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1).toISOString().split('T')[0];
    const end = new Date(year, m, 0).toISOString().split('T')[0];
    return [start, end];
  }
}
