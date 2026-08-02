# Roadmap — Jarvis AI

> Orientado pelos 8 pilares da visao (`VISION.md`). Cada fase prioriza o que mais aproxima o Jarvis de uma presenca real.

---

## Historico (Concluido)

| Fase | Entrega | Data | Status |
|------|---------|------|--------|
| 0 | Fundacao — monorepo, NestJS, Tauri, WebSocket, Prisma | 27/07 | ✅ |
| 1 | Chat por Texto — Ollama/OpenAI, streaming, historico | 27/07 | ✅ |
| 2 | Decision Engine — local-first, fallback, config na UI | 27/07 | ✅ |
| 3 | Tool Calling — CapabilityRegistry, Computer capability | 29/07 | ✅ |
| 4 | Voz — STT (Whisper), TTS (multi-engine), Wake Word (Web Speech API), VAD, barge-in | 30/07 | ✅ |
| 5 | Interface Viva — STICK design system, orb R3F, 7 estados, glass UI, 3 telas | 30/07 | ✅ |
| 6 | Memoria — pgvector, embeddings, sliding window, extracao automatica | 01/08 | ✅ |
| 7 | Conversacao Inteligente — prompt modular, fillers, classificacao de intencao | 01/08 | ✅ |
| 8 | Voz Nativa + Always-On — tray, autostart, hotkey, OpenWakeWord, voz expressiva | 02/08 | ✅ |

**Pendentes de fases anteriores:**
- [ ] 4c: Migrar wake word pra OpenWakeWord (movido pra Fase 8)
- [ ] 5.10: Widget flutuante / tray (movido pra Fase 8)
- [ ] 5.11: Autostart com o sistema (movido pra Fase 8)

---

## Gap Analysis — Visao vs Realidade

| Pilar | Descricao | Cobertura | Gap Principal |
|-------|-----------|-----------|---------------|
| 1. Escuta Permanente | Sempre disponivel, baixo consumo | 75% | OpenWakeWord nativo + tray + autostart + global hotkey |
| 2. Compreensao | Interpreta intencoes, proativo | 65% | Classificacao de intencao por heuristica, falta sugestoes proativas |
| 3. Memoria | Conhece o usuario, aprende | **70%** | pgvector + embeddings + extracao automatica. Falta contexto entre sessoes |
| 4. Conversacao Continua | Contexto entre turnos e sessoes | 50% | Sliding window + resumo. Falta carryover entre sessoes |
| 5. Voz Humana | Pausas, ritmo, emocao, enfase | 60% | Velocidade dinamica + pausas naturais, falta emocao |
| 6. Baixa Latencia | 200-500ms, respostas parciais | 65% | Fillers contextuais por intencao, TTS durante thinking |
| 7. Interface Viva | Orb reage a tudo | **80%** | Tray mode implementado, falta emocao no orb |
| 8. Capacidade de Agir | Smart home, lembretes, pesquisa | 20% | So Computer capability existe |

---

## Fase 6 — Memoria

> **Prioridade maxima.** Pre-requisito para compreensao, conversacao continua e personalizacao.
>
> Pilares: **3 (Memoria)**, **4 (Conversacao Continua)**, **2 (Compreensao)**

### 6a — Contexto de Conversa
- [x] Sliding window de mensagens (ultimas 30 + resumo das anteriores)
- [x] Resumo automatico de conversas longas (LLM gera summary apos 40 msgs)
- [ ] Contexto carregado entre sessoes ("continuar de onde parou")

### 6b — Memoria de Longo Prazo
- [x] Schema Prisma: `Memory` (tipo, conteudo, embedding vector(768), timestamps)
- [x] Tipos: preferencia, pessoa, projeto, dispositivo, habito, fato
- [x] pgvector para busca por similaridade semantica (docker pgvector/pgvector:pg17)
- [x] Embeddings via Ollama (nomic-embed-text) ou OpenAI (text-embedding-3-small, 768d)
- [x] Antes de responder: busca automatica de memorias relevantes e injeta no system prompt
- [x] Comando explicito: "Jarvis, lembra que..." / "anota que..." / "memoriza que..."
- [x] Inferencia automatica: extrai fatos de conversas naturalmente via LLM
- [x] WebSocket events: memory:list, memory:save, memory:delete, memory:search

**Entregavel:** "Jarvis, qual meu editor favorito?" — responde com base na memoria.

---

## Fase 7 — Conversacao Inteligente

> Jarvis deixa de ser reativo e passa a ser contextual e proativo.
>
> Pilares: **2 (Compreensao)**, **4 (Conversacao Continua)**, **6 (Baixa Latencia)**

### 7a — System Prompt Dinamico
- [x] System prompt carrega memorias relevantes + contexto da sessao
- [x] Prompt modular: personalidade base + memorias + capabilities disponiveis
- [x] Configuravel via Settings (tom, proatividade, detalhamento)

### 7b — Fillers de Latencia
- [x] Respostas parciais imediatas antes do LLM ("Boa pergunta...", "Deixa eu ver...")
- [x] TTS fala o filler enquanto LLM processa
- [x] Estado visual: `thinking` com texto do filler
- [x] Fillers contextuais por tipo de intencao

### 7c — Compreensao de Intencao
- [x] Classificacao de intencao por heuristicas (zero latencia): information, action, conversation, confirmation, memory
- [x] Intent injetado no system prompt para guiar resposta do LLM
- [x] Evento `intent:classified` no WebSocket para o frontend
- [ ] Sugestoes proativas baseadas em contexto e memoria (movido pra Fase 9)
- [ ] "Esta escuro aqui" → "Quer que eu acenda a luz?" (requer integracoes — Fase 10)

**Entregavel:** Jarvis responde em <500ms (filler), entende contexto entre turnos, classifica intencao.

---

## Fase 8 — Voz Nativa + Always-On

> Escuta permanente real e voz com personalidade.
>
> Pilares: **1 (Escuta Permanente)**, **5 (Voz Humana)**

### 8a — Wake Word Nativo
- [x] OpenWakeWord como microservico Python (localhost:5002, modelo local, offline)
- [x] Deteccao em background via sounddevice + WebSocket notifications
- [x] Funciona sem Chrome / sem browser — captura mic do sistema
- [x] Fallback automatico: nativo > Web Speech API

### 8b — Always-On
- [x] System tray icon com menu (Mostrar/Sair) e double-click
- [x] Minimize to tray — fechar janela esconde pro tray
- [x] Autostart com o sistema (tauri-plugin-autostart) com toggle em Settings
- [x] Global hotkey Ctrl+Shift+J pra mostrar/esconder de qualquer lugar

### 8c — Voz Expressiva
- [x] Velocidade dinamica por tipo de conteudo (listas +15%, explicacoes -8%, perguntas -5%)
- [x] Rate parameter no TTS server (Edge SSML rate)
- [x] Settings: base speed (slow/normal/fast) + toggle dynamic speed
- [x] Pausas naturais: headers e bullets viram sentences com periodo
- [ ] TTS com controle emocional (requer Qwen3-TTS emotions — futuro)

**Entregavel:** "Jarvis" acorda o sistema a qualquer momento. Voz com pausas naturais e ritmo variavel.

---

## Fase 9 — Capabilities Essenciais

> Jarvis resolve problemas, nao so conversa.
>
> Pilar: **8 (Capacidade de Agir)**

### 9a — Search
- [ ] Capability de pesquisa web (SearXNG local ou Tavily API)
- [ ] Decision Engine redireciona pra cloud quando detecta necessidade de pesquisa
- [ ] Resultados sumarizados pelo LLM

### 9b — Calendar + Lembretes
- [ ] CRUD de lembretes no banco
- [ ] Notificacoes agendadas (nativas do Tauri)
- [ ] "Jarvis, me lembra de X amanha as 9h"

### 9c — Notifications
- [ ] Telegram bot API
- [ ] Email via SMTP/Resend
- [ ] "Jarvis, manda isso no Telegram"

**Entregavel:** Pesquisa, lembretes e notificacoes funcionando por voz.

---

## Fase 10 — Integracoes

> Jarvis controla o ambiente.
>
> Pilar: **8 (Capacidade de Agir)**

### 10a — Finance
- [ ] Integrar com API financeira existente
- [ ] "Quanto gastei esse mes?" / "Qual meu saldo?"

### 10b — Home (Casa Inteligente)
- [ ] Home Assistant ou Tuya API
- [ ] Controlar luzes, tomadas, cenas
- [ ] "Jarvis, apaga as luzes"

### 10c — Musica
- [ ] Spotify API (play, pause, skip, busca)
- [ ] "Jarvis, toca algo pra relaxar"

**Entregavel:** Jarvis controla financas, casa e musica.

---

## V2 — Agentes Especializados

Quando uma capability ganha autonomia, ela vira um agente:

- [ ] Agente financeiro com analises proativas
- [ ] Agente de casa que aprende rotinas e sugere automacoes
- [ ] Agente de produtividade com sugestoes baseadas em calendario
- [ ] Multi-agent orchestration no Core

---

## V3 — Hardware Dedicado

- [ ] Mini PC rodando Jarvis 24/7 (Beelink/NUC/Jetson)
- [ ] Microfones em comodos (ReSpeaker / ESP32)
- [ ] Avatar V2/V3 (3D avancado)
- [ ] Wake word com voz direcional (saber de qual comodo veio)

---

## Resumo Visual

```
Fase 0-5  ██████████  Fundacao → Interface      ✅ Concluido
Fase 6    █████████░  Memoria                   ✅ (falta contexto entre sessoes)
Fase 7    ████████░░  Conversacao Inteligente   ✅ (falta sugestoes proativas)
Fase 8    █████████░  Voz Nativa + Always-On    ✅ (falta TTS emocional)
Fase 9    ░░░░░░░░░░  Capabilities Essenciais   ← PROXIMO
Fase 10   ░░░░░░░░░░  Integracoes
──────────────────────────────────────────────
V2        Agentes Especializados
V3        Hardware Dedicado
```

> Cada fase constroi sobre a anterior. Memoria (Fase 6) e o alicerce — sem ela, compreensao, conversacao continua e personalizacao nao funcionam.
