# Jarvis AI

Assistente pessoal local-first com voz, chat e tool calling. Interface glassmorphism com orb de particulas em R3F.

## Arquitetura

```
apps/
  api/          NestJS — LLM, tool calling, conversas, banco
  desktop/      Vite + React + Tauri — interface, orb, voz
packages/
  shared/       Types compartilhados (estados, eventos WebSocket)
```

O desktop conecta no backend via WebSocket (`localhost:3000`). Voz (STT/TTS) roda localmente via sidecars do Tauri (Whisper.cpp + Piper).

## Pre-requisitos

- **Node.js** >= 20
- **pnpm** >= 10 (`npm install -g pnpm`)
- **Docker** (para Postgres e Redis)
- **Ollama** (LLM local) — https://ollama.com
- **Rust** (para o Tauri)
- **MSVC Build Tools** (Windows — compilacao do Rust)

## Setup

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/Caslumch/stick-engine.git
cd stick-engine
pnpm install
```

### 2. Subir banco de dados

```bash
docker compose up -d
```

Sobe Postgres (porta 5432) e Redis (porta 6379).

### 3. Configurar banco

```bash
cp apps/api/.env.example apps/api/.env  # ou crie com o conteudo abaixo
cd apps/api && npx prisma db push
```

O `.env` precisa de:
```
DATABASE_URL="postgresql://jarvis:jarvis@localhost:5432/jarvis?schema=public"
```

### 4. Instalar Ollama e baixar modelo

```bash
ollama pull qwen2.5
```

O backend usa Ollama por padrao (`localhost:11434`). Para usar OpenAI, adicione `OPENAI_API_KEY` no `.env`.

### 5. Instalar Rust (se nao tiver)

**Windows:**
```powershell
winget install Rustlang.Rustup
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

**macOS/Linux:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

> **Windows 11:** Se o Smart App Control estiver ativo, desative-o em Seguranca do Windows > Controle de aplicativos e do navegador > Configuracoes do controle inteligente de aplicativos. Ele bloqueia a compilacao do Rust.

### 6. Baixar binarios de voz

```powershell
cd apps/desktop/src-tauri/binaries
powershell -ExecutionPolicy Bypass -File setup.ps1
```

Baixa automaticamente (~300MB):
- Whisper.cpp v1.9.1 (STT)
- Modelo Whisper base (pt-BR)
- Piper (TTS)
- Voz pt-BR (faber medium)

## Rodar

### Desenvolvimento (tudo junto)

```bash
pnpm dev
```

Sobe o backend (NestJS) e o frontend (Vite) em paralelo.

### App nativo (Tauri)

```bash
cd apps/desktop
pnpm tauri:dev
```

Abre a janela nativa com Whisper/Piper pra voz. Precisa do backend rodando (`pnpm dev` na raiz ou `cd apps/api && pnpm dev`).

### Somente no browser

```bash
cd apps/desktop
pnpm dev
```

Abre `http://localhost:5173`. Usa Web Speech API pra voz (so funciona no Chrome).

## Build

### Gerar instalador Windows

```bash
cd apps/desktop
pnpm tauri:build
```

Gera `.msi` e `.exe` em `src-tauri/target/release/bundle/`.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Desktop | Tauri v2 + Vite + React 19 |
| 3D | React Three Fiber v9 + Three.js |
| Backend | NestJS 11 + Prisma + Socket.IO |
| LLM | Vercel AI SDK (Ollama local, OpenAI/Anthropic cloud) |
| STT | Whisper.cpp (sidecar Tauri) |
| TTS | Piper (sidecar Tauri) |
| Banco | PostgreSQL 17 + Redis 7 |
| Monorepo | Turborepo + pnpm workspaces |

## Estrutura do desktop

```
src/
  app/        App.tsx, AgentStateProvider, OrbBridge
  orb/        JarvisOrb (R3F), shaders GLSL
  ui/         Glass, Nav, StatusPill, Mic, Composer, CommandPalette...
  screens/    Voice, Chat, Settings, Ambient
  theme/      ThemeProvider (dark/light/auto), Backdrop
  hooks/      useSocket, useAudioAmplitude, useSpeechRecognition, useTauriVoice
  styles/     tokens.css, glass.css, backdrop.css
  stores/     jarvis.store (Zustand)
```

## Atalhos

| Tecla | Acao |
|-------|------|
| `1` `2` `3` | Trocar tela (Voz, Chat, Settings) |
| `Espaco` | Push-to-talk |
| `T` | Alternar tema |
| `A` | Modo ambiente |
| `Ctrl+K` | Paleta de comandos |
| `Esc` | Interromper / sair do modo ambiente |
