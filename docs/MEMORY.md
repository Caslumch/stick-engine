# Memory — Jarvis AI

## Visao Geral

O Jarvis possui dois tipos de memoria que trabalham juntos para fornecer contexto nas conversas.

```
┌─────────────────────────────────────────┐
│              Jarvis Core                │
│                                         │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ Curto Prazo │  │  Longo Prazo    │   │
│  │   (Redis)   │  │  (PostgreSQL)   │   │
│  │             │  │                 │   │
│  │ Conversa    │  │ Preferencias    │   │
│  │ atual       │  │ Pessoas         │   │
│  │ Contexto    │  │ Projetos        │   │
│  │ sessao      │  │ Habitos         │   │
│  │             │  │ Dispositivos    │   │
│  └─────────────┘  │ Historico       │   │
│                   └─────────────────┘   │
└─────────────────────────────────────────┘
```

---

## Memoria de Curto Prazo

**Storage:** Redis
**Duracao:** Durante a sessao/conversa

### O que armazena
- Mensagens da conversa atual
- Contexto temporario (ex: "estou falando sobre o projeto X")
- Estado do usuario (ocupado, disponivel)

### Implementacao
```typescript
// memory/short-term.service.ts

interface ConversationContext {
  conversationId: string;
  messages: Message[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  lastActivityAt: Date;
}

// Sliding window: manter ultimas N mensagens no prompt
// Quando a conversa fica grande demais:
// 1. Resumir mensagens antigas com o LLM
// 2. Manter resumo + ultimas N mensagens
```

### Sliding Window Strategy
```
[msg1, msg2, ..., msg20] → conversa ficou grande
                          ↓
[resumo_msg1_a_msg15] + [msg16, msg17, msg18, msg19, msg20]
```

---

## Memoria de Longo Prazo

**Storage:** PostgreSQL (via Prisma)
**Duracao:** Permanente

### Categorias de Memoria

| Categoria | Exemplos |
|---|---|
| **Preferencias** | "Prefiro respostas curtas", "Editor favorito: VS Code" |
| **Pessoas** | "Maria e minha namorada", "Joao e meu socio" |
| **Projetos** | "Estou trabalhando no projeto Jarvis" |
| **Dispositivos** | "Luz do quarto = Tuya device X" |
| **Habitos** | "Acordo as 7h", "Trabalho de casa segunda e quarta" |
| **Fatos** | "Moro em Sao Paulo", "Trabalho como dev" |

### Schema Prisma
```prisma
model Memory {
  id        String   @id @default(cuid())
  category  String   // preference, person, project, device, habit, fact
  content   String   // descricao em linguagem natural
  embedding Float[]  // vetor para busca semantica (pgvector)
  metadata  Json?    // dados estruturados extras
  source    String   // como foi salva: explicit, inferred, conversation
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Busca Semantica (pgvector)
```typescript
// memory/long-term.service.ts

// 1. Antes de responder, buscar memorias relevantes
const relevantMemories = await this.searchMemories(userMessage);

// 2. Injetar no prompt como contexto
const systemPrompt = `
Voce e o Jarvis. Aqui esta o que voce sabe sobre o usuario:
${relevantMemories.map(m => `- ${m.content}`).join('\n')}
`;

// 3. Busca por similaridade usando embeddings
async searchMemories(query: string, limit = 5): Promise<Memory[]> {
  const embedding = await this.embed(query);
  return this.prisma.$queryRaw`
    SELECT *, embedding <=> ${embedding}::vector AS distance
    FROM "Memory"
    ORDER BY distance
    LIMIT ${limit}
  `;
}
```

---

## Como Memorias sao Salvas

### 1. Explicita (usuario pede)
```
"Jarvis, lembra que meu aniversario e dia 15 de marco"
→ Salva: { category: "fact", content: "Aniversario do usuario: 15 de marco" }
```

### 2. Inferida (Jarvis detecta)
```
Usuario menciona "minha namorada Maria" varias vezes
→ Jarvis pergunta: "Quer que eu lembre que Maria e sua namorada?"
→ Se sim: { category: "person", content: "Maria e a namorada do usuario" }
```

### 3. Conversa (extraida automaticamente)
```
Ao final de conversas significativas, extrair fatos relevantes
→ LLM analisa conversa e sugere memorias para salvar
```

---

## Embeddings

Para busca semantica, cada memoria precisa de um vetor (embedding).

### Opcoes
| Provider | Local? | Qualidade |
|---|---|---|
| Ollama (nomic-embed-text) | Sim | Boa |
| OpenAI text-embedding-3-small | Nao | Muito boa |

> **Recomendacao:** Usar Ollama para embeddings locais (coerente com local-first).

---

## Evolucao

- **V1 (MVP):** Apenas memoria curto prazo (contexto da conversa)
- **V1.1:** Memoria longo prazo com busca semantica
- **V2:** Inferencia automatica de memorias + memory management UI
- **V3:** Grafo de conhecimento pessoal
