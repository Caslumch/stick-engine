# Desktop App — Jarvis AI

## Visao Geral

O Jarvis roda como um app desktop nativo usando **Tauri 2 + React**. Compativel com Windows e macOS.

---

## Por que Tauri?

| Aspecto | Tauri | Electron |
|---|---|---|
| Tamanho do app | ~5 MB | ~150 MB |
| RAM | ~30 MB | ~150 MB+ |
| Backend | Rust (nativo) | Node.js |
| Sidecars | Suporte nativo | Manual |
| Seguranca | Sandbox por padrao | Permissivo |

Tauri e ideal para o Jarvis porque e leve, permite rodar sidecars nativos (Whisper, Piper) e tem acesso a APIs do SO.

---

## Telas

### 1. HUD (Tela Principal)

A tela principal do Jarvis. Sempre visivel.

```
┌─────────────────────────────┐
│                             │
│         ┌─────┐             │
│         │  ○  │  ← Avatar   │
│         └─────┘             │
│                             │
│    "Como posso ajudar?"     │
│                             │
│  ┌───────────────────────┐  │
│  │ Digite ou fale...     │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

**Estados visuais:**
- **Idle:** Esfera com pulso suave, cor neutra (azul)
- **Listening:** Esfera expandida, waveform, cor ativa (ciano)
- **Thinking:** Esfera com particulas orbitando, cor processando (roxo)
- **Speaking:** Esfera pulsando com a voz, cor falando (verde)

---

### 2. Chat / Historico

```
┌─────────────────────────────┐
│  ← Voltar    Conversas      │
│─────────────────────────────│
│  Hoje                       │
│  ┌───────────────────────┐  │
│  │ Sobre o projeto X     │  │
│  │ 14:30 · 12 msgs       │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Abrir VS Code         │  │
│  │ 10:15 · 3 msgs        │  │
│  └───────────────────────┘  │
│  Ontem                      │
│  ┌───────────────────────┐  │
│  │ Financas do mes       │  │
│  │ 18:00 · 8 msgs        │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

---

### 3. Settings

```
┌─────────────────────────────┐
│  ← Voltar    Configuracoes  │
│─────────────────────────────│
│                             │
│  Geral                      │
│  ├ Iniciar com sistema  [✓] │
│  ├ Idioma          [PT-BR]  │
│  └ Tema            [Dark]   │
│                             │
│  IA                         │
│  ├ Modelo local    [qwen2]  │
│  ├ OpenAI Key      [****]   │
│  ├ Anthropic Key   [****]   │
│  └ Preferir local  [✓]     │
│                             │
│  Voz                        │
│  ├ Wake word       [Jarvis] │
│  ├ Voz TTS     [pt-br-fem]  │
│  └ Velocidade TTS  [1.0x]  │
│                             │
│  Capabilities               │
│  ├ Computer        [✓]     │
│  ├ Search          [✓]     │
│  ├ Home            [✗]     │
│  └ Finance         [✓]     │
│                             │
└─────────────────────────────┘
```

---

### 4. Widget / Tray

Mini versao do HUD acessivel pela bandeja do sistema.

- Icone na system tray
- Click: abre/esconde janela principal
- Hotkey global (ex: `Ctrl+Shift+J`): toggle
- Mini HUD: apenas avatar + estado + input rapido

---

## Comportamentos

### Autostart
- Tauri suporta autostart nativo via plugin
- App inicia minimizado na tray
- Wake word ativa imediatamente

### Window Management
- Janela sem borda (frameless) para visual clean
- Sempre no topo (opcional, configuravel)
- Redimensionavel
- Arrastar pela area do HUD

### Comunicacao com Backend
- WebSocket persistente (reconnect automatico)
- Eventos bidirecionais:
  - `message:send` / `message:receive`
  - `state:change` (idle, listening, thinking, speaking)
  - `capability:result`
  - `audio:stream`

---

## Stack Frontend

```
React 19
├── Zustand (estado global)
├── Tailwind CSS (estilos)
├── Framer Motion (animacoes)
├── Socket.IO Client (websocket)
└── @tauri-apps/api (APIs nativas)
```

---

## Design System

| Token | Valor |
|---|---|
| Background | `#0a0a0f` (quase preto) |
| Surface | `#12121a` |
| Primary | `#00d4ff` (ciano Jarvis) |
| Accent | `#7c3aed` (roxo thinking) |
| Success | `#10b981` (verde speaking) |
| Text | `#e2e8f0` |
| Text muted | `#64748b` |
| Border | `#1e293b` |
| Font | `Inter` ou `JetBrains Mono` |

Visual escuro, limpo, com toques de neon — inspiracao Iron Man mas minimalista.
