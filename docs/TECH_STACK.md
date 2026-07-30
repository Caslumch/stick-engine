# Tech Stack — Jarvis AI

## Backend

| Tecnologia | Uso | Por que |
|---|---|---|
| **NestJS** | Framework principal | Modular por natureza, DI nativo, otimo para arquitetura de capabilities |
| **TypeScript** | Linguagem | Type safety end-to-end |
| **Prisma** | ORM | Type-safe queries, migrations automaticas, boa DX |
| **PostgreSQL** | Banco principal | Memoria longo prazo, historico, configs |
| **Redis** | Cache/Session | Memoria curto prazo, estado do HUD, pub/sub |
| **WebSocket** (Socket.IO ou ws) | Comunicacao real-time | HUD states, streaming de respostas |

---

## Frontend / Desktop

| Tecnologia | Uso | Por que |
|---|---|---|
| **Tauri** | Shell desktop | Leve (~5MB), nativo, acesso a APIs do SO |
| **React** | UI | Componentizacao, ecossistema, familiaridade |
| **Tailwind CSS** | Estilizacao | Rapido para prototipar, design system consistente |
| **Framer Motion** | Animacoes | HUD "vivo", transicoes de estado fluidas |
| **Zustand** | Estado global | Simples, sem boilerplate, bom com WebSocket |

---

## Inteligencia Artificial

| Tecnologia | Uso | Por que |
|---|---|---|
| **Ollama** | LLM local | Facil de rodar modelos locais, API REST compativel |
| **Vercel AI SDK** | Integracao LLM | Abstrai providers, streaming, tool calling unificado |
| **OpenAI API** | LLM cloud | Modelos avancados para tarefas complexas |
| **Anthropic API** | LLM cloud (alt) | Alternativa de alta qualidade |

---

## Voz

| Tecnologia | Uso | Por que |
|---|---|---|
| **OpenWakeWord** | Wake word detection | Open source, customizavel, roda local |
| **Whisper.cpp** | Speech-to-Text | Alta qualidade, roda local, baixa latencia |
| **Piper** | Text-to-Speech | Vozes naturais, roda local, leve |

> **Nota:** OpenWakeWord e Whisper.cpp rodam como processos separados (binarios nativos). O backend NestJS se comunica com eles via child_process ou sidecar do Tauri.

---

## Infraestrutura Dev

| Tecnologia | Uso |
|---|---|
| **Turborepo** | Monorepo management |
| **pnpm** | Package manager |
| **Docker Compose** | PostgreSQL + Redis local |
| **ESLint + Prettier** | Linting/formatting |
| **Vitest** | Testes unitarios |
| **GitHub Actions** | CI (lint, test, build) |

---

## Estrutura de Dependencias

```
packages/shared (types, constants)
    ↑               ↑
apps/api         apps/desktop
(NestJS)         (Tauri + React)
    ↕ WebSocket
```

---

## Versoes Recomendadas

- Node.js: 20 LTS+
- pnpm: 9+
- Tauri: 2.x
- NestJS: 10+
- Prisma: 6+
- React: 19+
- TypeScript: 5.5+
