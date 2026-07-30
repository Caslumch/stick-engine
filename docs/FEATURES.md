# Features — Jarvis AI

## Mapa de Funcionalidades

Cada feature esta associada a um pilar e a uma fase do roadmap.

---

## Pilar: IA

| Feature | Descricao | Fase | Prioridade |
|---|---|---|---|
| Chat por texto | Conversar via input de texto | 1 | MVP |
| LLM Local (Ollama) | Processar com modelo local | 1 | MVP |
| LLM Cloud (OpenAI/Anthropic) | Escalar para cloud quando necessario | 2 | MVP |
| Decision Engine | Escolha automatica local vs cloud | 2 | MVP |
| Tool Calling | LLM invoca tools/capabilities | 3 | MVP |
| Streaming | Resposta em tempo real (token a token) | 1 | MVP |
| Fallback automatico | Se local falha, tenta cloud | 2 | MVP |
| Multi-agent | Capabilities viram agentes autonomos | V2 | Futuro |

---

## Pilar: Voz

| Feature | Descricao | Fase | Prioridade |
|---|---|---|---|
| Wake Word | Detectar "Jarvis" continuamente | 4c | MVP |
| Speech-to-Text | Audio -> texto (Whisper.cpp) | 4a | MVP |
| Text-to-Speech | Texto -> audio (Piper) | 4b | MVP |
| Voz customizada | Treinar voz personalizada no Piper | V2 | Futuro |
| Voz direcional | Identificar de qual comodo veio o audio | V3 | Futuro |

---

## Pilar: Interface

| Feature | Descricao | Fase | Prioridade |
|---|---|---|---|
| HUD com estados | Idle, Listening, Thinking, Speaking | 5 | MVP |
| Avatar V1 (esfera) | Esfera minimalista animada | 5 | MVP |
| Historico de conversas | Listar e revisitar conversas | 1 | MVP |
| Tela de configuracoes | API keys, preferencias, capabilities | 2 | MVP |
| Widget/Tray | Mini HUD na bandeja do sistema | 5 | MVP |
| Autostart | Iniciar com o sistema | 5 | MVP |
| Avatar V2 (3D) | Esfera tridimensional | V2 | Futuro |
| Avatar V3 (animado) | Avatar totalmente animado | V3 | Futuro |

---

## Pilar: Automacao

| Feature | Descricao | Fase | Prioridade |
|---|---|---|---|
| Abrir programas | "Abre o VS Code" | 3 | MVP |
| Executar comandos | "Roda npm install" | 3 | MVP |
| Manipular arquivos | "Cria uma pasta chamada X" | 3 | MVP |
| Pesquisa web | "Pesquisa sobre X" | 7a | Alta |
| Lembretes | "Me lembra amanha as 9h" | 7b | Alta |
| Notificacoes | Enviar via Telegram/Email | 7c | Media |
| Financas | Consultar API financeira | 8a | Media |
| Casa inteligente | Controlar luzes, tomadas, cenas | 8b | Media |

---

## Pilar: Memoria

| Feature | Descricao | Fase | Prioridade |
|---|---|---|---|
| Memoria curto prazo | Contexto da conversa atual | 6a | MVP |
| Memoria longo prazo | Preferencias, pessoas, habitos | 6b | Alta |
| Busca semantica | Encontrar memorias por similaridade | 6b | Alta |
| Salvar explicito | "Jarvis, lembra que..." | 6b | Alta |

---

## Status Legend

- **MVP** — Necessario para V1
- **Alta** — Importante, logo apos MVP
- **Media** — Agrega valor, sem urgencia
- **Futuro** — V2/V3
