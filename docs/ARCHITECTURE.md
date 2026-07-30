# Arquitetura — Jarvis AI

## Visao Geral

O Jarvis segue uma arquitetura **modular em camadas**, onde o Core orquestra o fluxo sem conhecer os detalhes de cada capacidade.

```
┌─────────────────────────────────────────────────────┐
│                   DESKTOP APP (Tauri)               │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │    HUD    │  │ History  │  │    Settings      │  │
│  │  (React)  │  │ (React)  │  │    (React)       │  │
│  └─────┬─────┘  └────┬─────┘  └───────┬──────────┘  │
│        └──────────────┼────────────────┘              │
│                       │ WebSocket                     │
└───────────────────────┼───────────────────────────────┘
                        │
┌───────────────────────┼───────────────────────────────┐
│                  BACKEND (NestJS)                      │
│                       │                                │
│  ┌────────────────────▼──────────────────────────┐    │
│  │              Jarvis Core                       │    │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────┐  │    │
│  │  │ Session  │ │ Pipeline │ │ Capability    │  │    │
│  │  │ Manager  │ │ Runner   │ │ Registry      │  │    │
│  │  └──────────┘ └─────┬────┘ └───────┬───────┘  │    │
│  └──────────────────────┼──────────────┼──────────┘    │
│                         │              │               │
│  ┌──────────────────────▼──────────────┘               │
│  │                                                     │
│  │  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │  │ Decision Engine │  │     Capabilities          │  │
│  │  │                 │  │  ┌────────┐ ┌──────────┐  │  │
│  │  │ Local vs Cloud  │  │  │Computer│ │  Search  │  │  │
│  │  │ Router          │  │  │        │ │          │  │  │
│  │  └────────┬────────┘  │  ├────────┤ ├──────────┤  │  │
│  │           │           │  │  Home  │ │ Calendar │  │  │
│  │  ┌────────▼────────┐  │  │        │ │          │  │  │
│  │  │   LLM Gateway   │  │  ├────────┤ ├──────────┤  │  │
│  │  │                 │  │  │Finance │ │  Notify  │  │  │
│  │  │ Ollama | Cloud  │  │  └────────┘ └──────────┘  │  │
│  │  └─────────────────┘  └──────────────────────────┘  │
│  │                                                     │
│  │  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │  │   Voice Layer   │  │     Data Layer            │  │
│  │  │                 │  │                            │  │
│  │  │ Wake Word       │  │  PostgreSQL (Prisma)      │  │
│  │  │ STT (Whisper)   │  │  Redis (cache/session)    │  │
│  │  │ TTS (Piper)     │  │                            │  │
│  │  └─────────────────┘  └──────────────────────────┘  │
│  │                                                     │
│  └─────────────────────────────────────────────────────┘
└────────────────────────────────────────────────────────┘
```

---

## Fluxo Principal

```
Microfone → Wake Word → STT → Core → Decision Engine → LLM → Capabilities → TTS → Usuario
```

1. **Microfone** captura audio continuamente
2. **Wake Word** (OpenWakeWord) detecta "Jarvis"
3. **STT** (Whisper.cpp) transcreve o audio em texto
4. **Jarvis Core** recebe o texto e monta o contexto
5. **Decision Engine** decide: local ou cloud?
6. **LLM** processa e pode invocar tools
7. **Capabilities** executam as acoes solicitadas
8. **TTS** (Piper) converte resposta em audio
9. **Usuario** ouve a resposta

---

## Estrutura de Pastas (Monorepo)

```
jarvis/
├── apps/
│   ├── api/                  # NestJS backend
│   │   └── src/
│   │       ├── core/         # Jarvis Core (orquestrador)
│   │       ├── decision/     # Decision Engine
│   │       ├── llm/          # LLM Gateway (local + cloud)
│   │       ├── voice/        # STT, TTS, Wake Word
│   │       ├── memory/       # Memoria curto/longo prazo
│   │       ├── capabilities/ # Cada capability e um modulo
│   │       │   ├── computer/
│   │       │   ├── search/
│   │       │   ├── home/
│   │       │   ├── calendar/
│   │       │   ├── finance/
│   │       │   └── notifications/
│   │       └── gateway/      # WebSocket gateway
│   │
│   └── desktop/              # Tauri + React
│       ├── src/              # React app
│       │   ├── components/
│       │   │   ├── hud/
│       │   │   ├── history/
│       │   │   └── settings/
│       │   ├── hooks/
│       │   ├── stores/
│       │   └── styles/
│       └── src-tauri/        # Rust backend do Tauri
│
├── packages/
│   └── shared/               # Types, constants, utils compartilhados
│
├── prisma/
│   └── schema.prisma
│
├── docs/                     # Esta documentacao
├── docker-compose.yml        # PostgreSQL + Redis
├── turbo.json                # Turborepo config
└── package.json
```

---

## Principios Arquiteturais

1. **Core desacoplado** — O Core nao importa capabilities diretamente. Usa um Registry com interface padrao.
2. **Capability como modulo NestJS** — Cada capability e um modulo independente que se registra no CapabilityRegistry.
3. **LLM Gateway abstrato** — Uma interface unica para local (Ollama) e cloud (OpenAI/Anthropic). O Decision Engine escolhe qual usar.
4. **WebSocket bidirecional** — Frontend e backend se comunicam em tempo real para estados do HUD, streaming de respostas e eventos.
5. **Monorepo com Turborepo** — `apps/api` e `apps/desktop` compartilham types via `packages/shared`.

---

## Interface de uma Capability

```typescript
interface Capability {
  name: string;
  description: string;
  tools: Tool[];
  execute(action: string, params: Record<string, unknown>): Promise<CapabilityResult>;
}

interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
}

interface CapabilityResult {
  success: boolean;
  data?: unknown;
  message?: string;
}
```

Cada capability expoe suas tools pro LLM via tool calling. O Core registra todas as tools disponiveis e o LLM decide qual invocar.
