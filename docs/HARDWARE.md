# Hardware — Jarvis AI

## Visao Geral

A V3 do Jarvis preve um **Mini PC dedicado** rodando o sistema 24/7, servindo como hub central da casa.

---

## Fases de Hardware

### Fase Atual — Seu PC

O Jarvis roda no seu computador principal.

**Requisitos minimos para LLM local:**
- CPU: 8+ cores (para Whisper.cpp)
- RAM: 16 GB+ (modelos 7B precisam ~4-8 GB)
- GPU: Opcional mas recomendado (NVIDIA com CUDA para Ollama)
- Armazenamento: ~10 GB para modelos + dados
- Microfone: Qualquer um (USB recomendado para qualidade)

**Requisitos recomendados:**
- RAM: 32 GB
- GPU: NVIDIA com 8+ GB VRAM (RTX 3060+)
- SSD NVMe

---

### V3 — Mini PC Dedicado

O objetivo e um dispositivo sempre ligado, similar a um smart speaker mas com capacidade de LLM local.

**Opcoes de hardware:**

| Dispositivo | CPU | RAM | GPU/NPU | Preco aprox. |
|---|---|---|---|---|
| Intel NUC 13 | i5/i7 13th gen | 32-64 GB | Intel Arc (iGPU) | ~R$3.000 |
| Beelink SER7 | Ryzen 7 7840HS | 32 GB | Radeon 780M (iGPU) | ~R$2.500 |
| NVIDIA Jetson Orin | ARM Cortex | 16-64 GB | Ampere GPU | ~R$3.500 |
| Mac Mini M4 | Apple M4 | 16-24 GB | Apple Neural Engine | ~R$5.000 |
| Custom ITX | Ryzen/Intel | 32+ GB | RTX 4060 | ~R$4.000 |

> **Recomendacao:** Beelink ou NUC com 32 GB RAM sao suficientes para rodar modelos 7B-13B com boa performance.

---

## Configuracao do Mini PC

### Sistema Operacional
- **Ubuntu Server 24.04 LTS** (headless, sem interface grafica)
- ou **Windows** se preferir manter a stack consistente

### Servicos
```
Mini PC
├── Jarvis API (NestJS) — porta 3000
├── Ollama — porta 11434
├── PostgreSQL — porta 5432
├── Redis — porta 6379
├── Whisper.cpp (servico)
├── Piper (servico)
└── OpenWakeWord (servico)
```

### Rede
- IP fixo na rede local
- Microfones conectados via USB ou rede
- Desktop app conecta ao Mini PC via WebSocket (ao inves de localhost)

---

## Arquitetura com Mini PC

```
┌──────────────┐         ┌──────────────────────────┐
│  Desktop App │ ◄─WS──► │      Mini PC (24/7)      │
│  (Tauri)     │         │                          │
│  Windows/Mac │         │  NestJS API              │
└──────────────┘         │  Ollama                  │
                         │  PostgreSQL + Redis      │
┌──────────────┐         │  Voice Pipeline          │
│  Microfone   │ ◄─USB─► │                          │
│  (comodo)    │         │  Home Assistant (futuro) │
└──────────────┘         └──────────────────────────┘
```

---

## Microfones para a Casa

Para o Jarvis funcionar em multiplos comodos:

| Opcao | Tipo | Observacao |
|---|---|---|
| Microfone USB | Direto no Mini PC | Apenas 1 comodo |
| ReSpeaker | Array de microfones | Deteccao direcional, ideal |
| ESP32 + I2S Mic | DIY WiFi mic | Barato, requer firmware custom |
| Raspberry Pi + Mic | Satelite | Roda wake word local, envia audio |

---

## Evolucao

1. **Agora:** Jarvis roda no seu PC principal
2. **V3 inicial:** Mini PC na mesa/escritorio, 1 microfone
3. **V3 expandido:** Microfones em comodos, Mini PC centralizado
4. **Futuro:** Multiplos Mini PCs, mesh de audio, sensores
