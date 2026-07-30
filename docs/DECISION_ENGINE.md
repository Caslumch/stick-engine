# Decision Engine — Jarvis AI

## O que e

O Decision Engine e o cerebro de roteamento do Jarvis. Ele decide **qual modelo de IA utilizar** para cada requisicao, sem que o usuario precise escolher manualmente.

---

## Principio

> **Local first, cloud when necessary.**

O objetivo e maximizar o uso de modelos locais (rapido, privado, gratuito) e so escalar para cloud quando houver ganho real.

---

## Fluxo de Decisao

```
Input do usuario
       │
       ▼
┌──────────────────┐
│ Tem internet?    │──── Nao ──── Local LLM
└────────┬─────────┘
         │ Sim
         ▼
┌──────────────────┐
│ Exige pesquisa?  │──── Sim ──── Cloud LLM + Search Tool
└────────┬─────────┘
         │ Nao
         ▼
┌──────────────────┐
│ Contexto grande? │──── Sim ──── Cloud LLM (janela maior)
│ (> X tokens)     │
└────────┬─────────┘
         │ Nao
         ▼
┌──────────────────┐
│ Tarefa complexa? │──── Sim ──── Cloud LLM
│ (code, analise)  │
└────────┬─────────┘
         │ Nao
         ▼
     Local LLM
```

---

## Criterios Detalhados

| Criterio | Como detectar | Acao |
|---|---|---|
| **Sem internet** | Health check periodico | Forca local |
| **Pesquisa web** | Palavras-chave: "pesquisa", "busca", "o que e X hoje" | Cloud + Search capability |
| **Contexto grande** | Token count > threshold (ex: 4096) | Cloud (janela maior) |
| **Tarefa complexa** | Heuristica: code generation, analise longa, raciocinio multi-step | Cloud |
| **Conversa simples** | Default | Local |
| **Comando direto** | Tool call obvio ("abre o Chrome") | Local (nem precisa de LLM forte) |

---

## Implementacao Sugerida

```typescript
// decision/decision-engine.service.ts

interface DecisionContext {
  message: string;
  tokenCount: number;
  hasInternet: boolean;
  conversationHistory: Message[];
  availableTools: Tool[];
}

interface DecisionResult {
  provider: 'local' | 'cloud';
  model: string;
  reason: string;
}

class DecisionEngineService {
  decide(context: DecisionContext): DecisionResult {
    if (!context.hasInternet) {
      return { provider: 'local', model: 'qwen2.5', reason: 'offline' };
    }

    if (this.requiresSearch(context.message)) {
      return { provider: 'cloud', model: 'gpt-4o', reason: 'search-required' };
    }

    if (context.tokenCount > this.localTokenLimit) {
      return { provider: 'cloud', model: 'gpt-4o', reason: 'context-too-large' };
    }

    if (this.isComplexTask(context.message)) {
      return { provider: 'cloud', model: 'gpt-4o', reason: 'complex-task' };
    }

    return { provider: 'local', model: 'qwen2.5', reason: 'default-local' };
  }
}
```

---

## Fallback

Se o provider escolhido falhar:

1. **Local falha** → tenta cloud (se online)
2. **Cloud falha** → tenta local com prompt simplificado
3. **Ambos falham** → retorna mensagem de erro amigavel

---

## Observabilidade

Cada decisao sera logada para que voce possa analisar e ajustar os criterios:

```typescript
interface DecisionLog {
  timestamp: Date;
  input: string;
  provider: string;
  model: string;
  reason: string;
  latencyMs: number;
  success: boolean;
}
```

---

## Evolucao Futura

- **V1:** Regras fixas (if/else baseado nos criterios acima)
- **V1.1:** Regras configuraveis via settings
- **V2:** Classificador treinado com base nos logs de decisao
- **V3:** Auto-tuning baseado em feedback do usuario
