# Capabilities — Jarvis AI

## O que sao

Capabilities sao **modulos independentes** que dao habilidades ao Jarvis. O Core nao conhece os detalhes de cada capability — ele apenas sabe que elas existem e expoe suas tools para o LLM.

---

## Arquitetura

```
┌──────────────────────────────────────┐
│          Capability Registry         │
│                                      │
│  register(capability) → tools[]      │
│  getAll() → Capability[]             │
│  findByTool(name) → Capability       │
│                                      │
│  ┌──────┐ ┌──────┐ ┌──────┐         │
│  │Compu-│ │Search│ │ Home │  ...     │
│  │ ter  │ │      │ │      │         │
│  └──────┘ └──────┘ └──────┘         │
└──────────────────────────────────────┘
```

---

## Interface Base

```typescript
// capabilities/capability.interface.ts

interface Capability {
  /** Nome unico da capability */
  name: string;

  /** Descricao para o LLM entender quando usar */
  description: string;

  /** Lista de tools que esta capability expoe */
  tools: Tool[];

  /** Executar uma acao */
  execute(toolName: string, params: Record<string, unknown>): Promise<CapabilityResult>;
}

interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, JSONSchemaProperty>;
    required?: string[];
  };
}

interface CapabilityResult {
  success: boolean;
  data?: unknown;
  message?: string;
}
```

---

## Capabilities Planejadas

### Computer (Fase 3 — MVP)

Controlar o computador do usuario.

| Tool | Descricao | Exemplo |
|---|---|---|
| `open_application` | Abrir um programa | "Abre o Chrome" |
| `run_command` | Executar comando no terminal | "Roda npm start" |
| `manage_files` | Criar, mover, deletar arquivos | "Cria uma pasta projetos" |

```typescript
// capabilities/computer/computer.capability.ts
tools: [
  {
    name: 'open_application',
    description: 'Abre um aplicativo no computador do usuario',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome do aplicativo' }
      },
      required: ['name']
    }
  },
  // ...
]
```

**Seguranca:** Whitelist de comandos permitidos. Comandos destrutivos pedem confirmacao.

---

### Search (Fase 7a)

Pesquisar informacoes na internet.

| Tool | Descricao | Exemplo |
|---|---|---|
| `web_search` | Pesquisar na web | "Pesquisa sobre NestJS" |
| `summarize_url` | Resumir uma pagina | "Resuma esse artigo" |

**Opcoes de busca:**
- SearXNG (self-hosted, privado)
- Tavily API
- Serper API

---

### Calendar (Fase 7b)

Lembretes e compromissos.

| Tool | Descricao | Exemplo |
|---|---|---|
| `create_reminder` | Criar lembrete | "Me lembra amanha as 9h" |
| `list_reminders` | Listar lembretes | "Quais meus lembretes?" |
| `delete_reminder` | Remover lembrete | "Cancela o lembrete de amanha" |

---

### Home (Fase 8b)

Controlar dispositivos inteligentes.

| Tool | Descricao | Exemplo |
|---|---|---|
| `control_device` | Ligar/desligar dispositivo | "Apaga a luz do quarto" |
| `set_scene` | Ativar cena | "Ativa modo cinema" |
| `list_devices` | Listar dispositivos | "Quais dispositivos tenho?" |

**Integracao:** Home Assistant API ou Tuya API direta.

---

### Finance (Fase 8a)

Integrar com API financeira existente.

| Tool | Descricao | Exemplo |
|---|---|---|
| `get_balance` | Consultar saldo | "Qual meu saldo?" |
| `get_expenses` | Consultar gastos | "Quanto gastei esse mes?" |
| `get_summary` | Resumo financeiro | "Como estao minhas financas?" |

---

### Notifications (Fase 7c)

Enviar mensagens/notificacoes.

| Tool | Descricao | Exemplo |
|---|---|---|
| `send_telegram` | Enviar via Telegram | "Manda X no Telegram pra Y" |
| `send_email` | Enviar email | "Manda um email pra Z" |

---

## Como Registrar uma Nova Capability

```typescript
// 1. Criar modulo NestJS
@Module({
  providers: [MyCapabilityService],
  exports: [MyCapabilityService],
})
export class MyCapabilityModule {}

// 2. Implementar a interface Capability
@Injectable()
export class MyCapabilityService implements Capability {
  name = 'my_capability';
  description = 'Faz algo incrivel';
  tools = [/* ... */];

  async execute(toolName: string, params: Record<string, unknown>) {
    // ...
  }
}

// 3. Importar no AppModule — o CapabilityRegistry detecta automaticamente
```

---

## Evolucao: Capability → Agent

Quando uma capability ganhar complexidade suficiente, ela pode evoluir para um **agente especializado**:

```
Capability (V1)          Agent (V2)
─────────────            ──────────
Stateless                Stateful
Reativo                  Proativo
Single tool call         Multi-step reasoning
Core orquestra           Auto-orquestra
```

Exemplo: A capability `Finance` que so responde consultas evolui para um agente que analisa gastos proativamente e alerta sobre anomalias.
