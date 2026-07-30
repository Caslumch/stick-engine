# Roadmap — Jarvis AI

> Roadmap detalhado com fases incrementais. Cada fase tem entregas claras e pode ser desenvolvida no seu ritmo.

---

## Fase 0 — Fundacao ✅ (Concluida em 27/07/2026)

**Objetivo:** Setup do monorepo, infraestrutura base e "hello world" end-to-end.

- [x] Criar monorepo com Turborepo + pnpm
- [x] Setup `apps/api` com NestJS + TypeScript
- [x] Setup `apps/desktop` com Vite + React + Tailwind (Tauri pendente — requer Rust)
- [x] Setup `packages/shared` com types compartilhados
- [x] Docker Compose com PostgreSQL + Redis
- [x] Prisma schema inicial (Conversation, Message)
- [x] WebSocket gateway basico (NestJS <-> React)
- [x] Verificar que desktop abre e conecta ao backend
- [x] Prettier configurado
- [x] Arquitetura clean pragmatica (gateway/service/repository por modulo)
- [x] Config centralizado com `@nestjs/config`
- [x] LLM providers com AI SDK (sem fetch manual)
- [x] Injecao dinamica de providers via `LLM_PROVIDERS` token
- [x] Fallback chain entre providers
- [x] WebSocket emit por client (nao broadcast)

**Entregavel:** Monorepo funcional. Desktop abre, conecta via WebSocket ao backend, e exibe "Jarvis Online". ✅

**Pendente:**
- [ ] Instalar Rust e adicionar Tauri como shell desktop
- [ ] ESLint configurado
- [ ] README com instrucoes de setup

---

## Fase 1 — Chat por Texto ✅ (Concluida em 27/07/2026)

**Objetivo:** Conversar com o Jarvis via texto usando LLM local.

- [x] Modulo `llm/` com LLM Gateway (interface abstrata)
- [x] Provider Ollama (LLM local) via AI SDK + OpenAI-compatible endpoint
- [x] Provider OpenAI (LLM cloud) via AI SDK
- [x] Endpoint/evento WebSocket para enviar mensagem
- [x] Streaming de resposta via WebSocket
- [x] UI de chat no desktop (input + mensagens + auto-scroll + timestamps)
- [x] Persistir conversas no PostgreSQL via Prisma
- [x] Tela de historico de conversas
- [x] System prompt do Jarvis (personalidade, PT-BR, tom)
- [x] Geracao automatica de titulo da conversa
- [x] Botao de nova conversa
- [x] Indicador de provider (ollama/openai) nas mensagens
- [x] Tratamento de erro com mensagem amigavel na UI

**Entregavel:** Digitar uma mensagem no desktop, Jarvis responde via Ollama com streaming em PT-BR. ✅

---

## Fase 2 — Decision Engine + Cloud ✅ (Concluida em 27/07/2026)

**Objetivo:** Jarvis decide sozinho quando usar local vs cloud.

> Nota: Decision Engine basico e fallback ja foram implementados na Fase 0. Esta fase refina as regras e adiciona configuracao na UI.

- [x] Modulo `decision/` com Decision Engine
- [x] Regras iniciais: internet? contexto grande? pesquisa?
- [x] Provider OpenAI/Anthropic (LLM cloud) via AI SDK
- [x] Fallback automatico (se local falha, tenta cloud)
- [x] Indicador na UI mostrando qual provider esta sendo usado (destacado)
- [x] Configuracoes de API keys na tela de settings
- [x] Regras configuraveis (threshold de tokens, keywords de pesquisa)
- [ ] Log de decisoes visivel no frontend (modo debug)

**Entregavel:** Jarvis usa Ollama por padrao. Para perguntas complexas ou quando local falha, escala pra cloud automaticamente. ✅

---

## Fase 3 — Tool Calling + Capabilities ✅ (Concluida em 29/07/2026)

**Objetivo:** Jarvis executa acoes no computador.

- [x] `CapabilityRegistry` — registro dinamico de capabilities
- [x] Interface `Capability` + `Tool` (contratos)
- [x] Capability: **Computer** (abrir programas, executar comandos, manipular arquivos)
- [x] Integrar tools no prompt do LLM (tool calling via AI SDK)
- [x] LLM invoca tools -> Core executa -> retorna resultado
- [x] Sandbox de seguranca para execucao de comandos (whitelist + blocked patterns)
- [x] Indicadores visuais de tool execution no chat
- [ ] Tela de capabilities instaladas no settings

**Entregavel:** "Jarvis, abre o VS Code" — Jarvis usa tool calling pra executar o comando. ✅

---

## Fase 4 — Voz (Semanas 11-14)

**Objetivo:** Conversar com o Jarvis por voz.

### 4a — Speech-to-Text ✅ (Web Speech API — ponte ate Whisper)
- [x] Captura de audio via getUserMedia (microfone)
- [x] Pipeline: audio -> Web Speech API (SpeechRecognition) -> texto -> Core
- [x] Transcricao parcial em tempo real na tela de voz
- [x] Indicador visual "Listening" no HUD
- [ ] Migrar para Whisper.cpp como sidecar/child_process (requer Tauri)

### 4b — Text-to-Speech ✅ (Web Speech API — ponte ate Piper)
- [x] Pipeline: resposta texto -> Web Speech API (SpeechSynthesis) -> speaker
- [x] Indicador visual "Speaking" no HUD
- [x] Fila de audio (nao sobrepor falas)
- [x] Cancel/Interrupt para TTS
- [ ] Migrar para Piper como sidecar/child_process (requer Tauri)

### 4c — Wake Word
- [ ] Integrar OpenWakeWord
- [ ] Deteccao continua em background
- [ ] Palavra: "Jarvis"
- [ ] Transicao de estado: Idle -> Listening

**Entregavel:** Dizer algo e ouvir a resposta. ✅ (via Web Speech API)
Wake word pendente — requer Tauri para deteccao continua em background.

---

## Fase 5 — HUD + Interface Viva (design system STICK) ✅ (Core concluido em 30/07/2026)

**Objetivo:** Interface que transmite presenca. Especificacao completa em
docs/DESIGN_SYSTEM.md; plano de execucao em docs/HANDOFF.md.

> Executada ANTES da Fase 4 (Voz): apenas a capsula de gravacao depende de audio,
> e ela pode ser construida com getUserMedia antes do Whisper existir.

- [x] Componente HUD com estados basicos
- [x] Avatar V1: esfera minimalista
- [x] 5.0  Alinhar versoes (R3F v9 + React 19 + Three 0.185)
- [x] 5.1  Tokens + ThemeProvider (dark/light/auto)
- [x] 5.2  Vidro + backdrop (manchas, tint radial, imagem de fundo)
- [x] 5.3  Estado do agente: 7 estados + propagacao de --accent por CSS
- [x] 5.4  Orb R3F integrado, <Canvas> persistente, bridge de estado
- [x] 5.5  Tela de voz + nav flutuante + status pill
- [x] 5.6  Capsula de gravacao + waveform (getUserMedia; STT entra na Fase 4)
- [x] 5.7  Tela de chat + painel de historico em gaveta
- [x] 5.8  Tela de settings
- [x] 5.9  Paleta de comandos (⌘K) + modo ambiente + create button
- [ ] 5.10 Widget flutuante (tray + mini HUD) — SEM DESIGN AINDA
- [ ] 5.11 Autostart com o sistema (Tauri)

**Entregavel:** Jarvis com interface que respira e transmite estado. ✅
5.0 a 5.9 fechadas; 5.10 e 5.11 dependem do Tauri instalado.
---

## Fase 6 — Memoria (Semanas 18-20)

**Objetivo:** Jarvis lembra de voce.

### 6a — Memoria Curto Prazo
- [ ] Contexto da conversa atual em Redis
- [ ] Sliding window de mensagens no prompt
- [ ] Resumo automatico de conversas longas

### 6b — Memoria Longo Prazo
- [ ] Schema Prisma: Memory (tipo, conteudo, embedding, timestamps)
- [ ] Salvar: preferencias, pessoas, projetos, habitos
- [ ] Busca por similaridade (embeddings + pgvector)
- [ ] Jarvis consulta memoria automaticamente ao responder
- [ ] Comando "Jarvis, lembra que..." para salvar explicitamente

**Entregavel:** "Jarvis, qual meu editor favorito?" — Jarvis responde com base na memoria.

---

## Fase 7 — Capabilities Extras (Semanas 21-25)

**Objetivo:** Expandir habilidades do Jarvis.

### 7a — Search
- [ ] Capability de pesquisa web (SearXNG local ou API)
- [ ] Jarvis decide quando precisa pesquisar
- [ ] Retorna resultados sumarizados

### 7b — Calendar
- [ ] Capability de lembretes e compromissos
- [ ] CRUD de lembretes no banco
- [ ] Notificacoes agendadas
- [ ] "Jarvis, me lembra de X amanha as 9h"

### 7c — Notifications
- [ ] Capability para enviar mensagens
- [ ] Integracao Telegram (bot API)
- [ ] Integracao Email (SMTP/Resend)
- [ ] WhatsApp (futuro — API complexa)

**Entregavel:** "Jarvis, pesquisa sobre X" / "Me lembra disso amanha" / "Manda isso no Telegram"

---

## Fase 8 — Integracoes (Semanas 26-30)

### 8a — Finance
- [ ] Integrar com API financeira existente do Lucas
- [ ] "Quanto gastei esse mes?"
- [ ] "Qual meu saldo?"

### 8b — Home (Casa Inteligente)
- [ ] Integracao com Home Assistant ou Tuya API
- [ ] Capability: ligar/desligar luzes, tomadas, cenas
- [ ] "Jarvis, apaga as luzes"

**Entregavel:** Jarvis controla financas e casa inteligente.

---

## V2 — Agentes Especializados (Futuro)

Quando uma capability ganhar autonomia suficiente, ela evolui para um agente:

- [ ] Agente financeiro com analises proativas
- [ ] Agente de casa que aprende rotinas
- [ ] Agente de produtividade com sugestoes
- [ ] Multi-agent orchestration no Core

---

## V3 — Hardware Dedicado (Futuro)

- [ ] Mini PC rodando Jarvis 24/7
- [ ] Microfones em comodos da casa
- [ ] Avatar V2/V3 (3D)
- [ ] Wake word com voz direcional

---

## Resumo Visual

```
Fase 0  ██████████  Fundacao             ✅
Fase 1  ██████████  Chat Texto           ✅
Fase 2  ██████████  Decision Engine      ✅
Fase 3  ██████████  Tool Calling         ✅
Fase 4  ███████░░░  Voz (STT/TTS)        ✅ (Wake word pendente)
Fase 5  █████████░  HUD + Interface      ✅ (5.10/5.11 pendentes — Tauri)
Fase 6  ░░░░░░░░░░  Memoria
Fase 7  ░░░░░░░░░░  Capabilities
Fase 8  ░░░░░░░░░░  Integracoes
────────────────────────────────────────
V2      Agentes
V3      Hardware
```

> **Dica:** As semanas sao estimativas. O importante e seguir a ordem das fases — cada uma constroi sobre a anterior.
