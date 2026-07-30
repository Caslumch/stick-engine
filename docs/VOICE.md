# Voice — Jarvis AI

## Visao Geral

O pipeline de voz e composto por tres componentes independentes que rodam localmente:

```
Microfone → [OpenWakeWord] → [Whisper.cpp] → texto
texto resposta → [Piper] → Speaker
```

---

## 1. Wake Word — OpenWakeWord

**Funcao:** Detectar a palavra "Jarvis" continuamente.

### Como funciona
- Roda como processo em background
- Escuta o microfone constantemente
- Quando detecta "Jarvis", notifica o backend
- Backend transiciona estado para `Listening`

### Integracao com NestJS
```typescript
// voice/wake-word.service.ts
// Opcoes de integracao:
// 1. Child process Python (OpenWakeWord e Python)
// 2. WebSocket com um micro-servico Python
// 3. Sidecar do Tauri (recomendado para desktop)
```

### Consideracoes
- OpenWakeWord e Python — sera um sidecar separado
- Alternativa: treinar modelo custom com sua propria voz dizendo "Jarvis"
- Threshold de confianca ajustavel (evitar falsos positivos)

---

## 2. Speech-to-Text — Whisper.cpp

**Funcao:** Converter audio em texto.

### Como funciona
- Ativado apos wake word ser detectada
- Grava audio ate detectar silencio (VAD — Voice Activity Detection)
- Processa o audio com Whisper.cpp
- Retorna texto transcrito

### Modelos recomendados
| Modelo | Tamanho | Qualidade | Velocidade |
|---|---|---|---|
| `whisper-tiny` | 75 MB | Basica | Muito rapida |
| `whisper-base` | 142 MB | Boa | Rapida |
| `whisper-small` | 466 MB | Muito boa | Moderada |
| `whisper-medium` | 1.5 GB | Excelente | Lenta |

> **Recomendacao MVP:** `whisper-base` ou `whisper-small` — bom balanco para PT-BR.

### Integracao
```typescript
// voice/stt.service.ts
interface STTResult {
  text: string;
  language: string;
  confidence: number;
  durationMs: number;
}

// Whisper.cpp roda como binario nativo
// Comunicacao via stdin/stdout ou arquivo temporario
```

### Deteccao de Silencio (VAD)
- Usar WebRTC VAD ou Silero VAD
- Parar gravacao apos ~1.5s de silencio
- Timeout maximo de ~30s

---

## 3. Text-to-Speech — Piper

**Funcao:** Converter resposta em audio falado.

### Como funciona
- Recebe texto do Core
- Piper gera audio WAV
- Audio e reproduzido pelo speaker

### Vozes
- Piper tem vozes pre-treinadas para PT-BR
- Qualidade varia — testar e escolher a melhor
- Possivel treinar voz custom no futuro

### Integracao
```typescript
// voice/tts.service.ts
interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
}

interface TTSResult {
  audioBuffer: Buffer;
  durationMs: number;
}

// Piper roda como binario nativo
// Input: texto via stdin
// Output: audio WAV via stdout
```

### Fila de Audio
- Respostas longas sao divididas em chunks (por sentenca)
- Cada chunk e sintetizado e reproduzido sequencialmente
- Permite inicio mais rapido da resposta (nao espera sintetizar tudo)

---

## Pipeline Completo

```
Estado: Idle
    │
    ▼ [Wake Word detectada]
Estado: Listening
    │ grava audio
    ▼ [silencio detectado]
Estado: Thinking
    │ Whisper transcreve
    │ Core processa
    │ LLM responde
    ▼ [resposta pronta]
Estado: Speaking
    │ Piper sintetiza
    │ Audio reproduzido
    ▼ [audio terminou]
Estado: Idle
```

---

## Sidecars / Processos

Os tres componentes de voz sao **binarios nativos** (nao Node.js):

| Componente | Linguagem | Formato |
|---|---|---|
| OpenWakeWord | Python | Processo separado / microservico |
| Whisper.cpp | C++ | Binario nativo |
| Piper | C++ | Binario nativo |

O Tauri permite rodar "sidecars" — binarios que acompanham o app. Essa e a forma recomendada de distribuir Whisper e Piper.

---

## Alternativa Cloud (Fallback)

Se hardware local nao suportar Whisper/Piper com qualidade:

- **STT Cloud:** OpenAI Whisper API, Google Speech-to-Text
- **TTS Cloud:** OpenAI TTS, ElevenLabs, Google TTS

A decisao pode ser integrada ao Decision Engine.
