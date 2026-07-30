# API — Jarvis AI

## Visao Geral

O backend NestJS expoe APIs via **WebSocket** (principal) e **REST** (auxiliar).

WebSocket e o canal primario — permite streaming bidirecional em tempo real. REST e usado para operacoes CRUD simples.

---

## WebSocket Events

### Conexao
```
ws://localhost:3000
```

### Client → Server

| Evento | Payload | Descricao |
|---|---|---|
| `message:send` | `{ text, conversationId? }` | Enviar mensagem de texto |
| `audio:send` | `{ audio: Buffer, format: string }` | Enviar audio para STT |
| `conversation:create` | `{}` | Criar nova conversa |
| `conversation:list` | `{ page?, limit? }` | Listar conversas |
| `state:get` | `{}` | Pedir estado atual |
| `settings:update` | `{ key, value }` | Atualizar configuracao |

### Server → Client

| Evento | Payload | Descricao |
|---|---|---|
| `message:stream` | `{ token, conversationId }` | Token de streaming |
| `message:complete` | `{ message, conversationId }` | Mensagem completa |
| `message:error` | `{ error, conversationId }` | Erro no processamento |
| `state:change` | `{ state: 'idle'|'listening'|'thinking'|'speaking' }` | Mudanca de estado |
| `audio:response` | `{ audio: Buffer }` | Audio TTS |
| `capability:executing` | `{ tool, params }` | Capability sendo executada |
| `capability:result` | `{ tool, result }` | Resultado da capability |
| `wake:detected` | `{}` | Wake word detectada |
| `decision:made` | `{ provider, model, reason }` | Decisao do engine |

---

## REST Endpoints

Base URL: `http://localhost:3000/api`

### Conversations

```
GET    /conversations              # Listar conversas
GET    /conversations/:id          # Detalhes de uma conversa
GET    /conversations/:id/messages # Mensagens de uma conversa
DELETE /conversations/:id          # Deletar conversa
```

### Memory

```
GET    /memories                   # Listar memorias
POST   /memories                   # Criar memoria manualmente
PUT    /memories/:id               # Atualizar memoria
DELETE /memories/:id               # Deletar memoria
GET    /memories/search?q=         # Buscar memorias
```

### Capabilities

```
GET    /capabilities               # Listar capabilities registradas
GET    /capabilities/:name/tools   # Tools de uma capability
```

### Settings

```
GET    /settings                   # Todas as configuracoes
PUT    /settings/:key              # Atualizar configuracao
```

### Health

```
GET    /health                     # Status do sistema
GET    /health/ollama              # Status do Ollama
GET    /health/voice               # Status dos servicos de voz
```

---

## Schemas

### Message

```typescript
interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  provider?: string;        // 'ollama' | 'openai' | 'anthropic'
  model?: string;           // 'qwen2.5' | 'gpt-4o' | etc
  createdAt: string;        // ISO 8601
}
```

### Conversation

```typescript
interface Conversation {
  id: string;
  title: string;           // gerado automaticamente
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}
```

### ToolCall

```typescript
interface ToolCall {
  id: string;
  name: string;             // 'open_application', 'web_search', etc
  arguments: Record<string, unknown>;
  result?: CapabilityResult;
}
```

### JarvisState

```typescript
type JarvisState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface StatePayload {
  state: JarvisState;
  metadata?: {
    provider?: string;     // durante thinking
    tool?: string;         // durante capability execution
  };
}
```

---

## Fluxo de uma Mensagem (WebSocket)

```
Client                          Server
  │                               │
  ├── message:send ──────────────►│
  │   { text: "Abre o Chrome" }   │
  │                               ├── state:change { state: 'thinking' }
  │◄──────────────────────────────┤
  │                               ├── decision:made { provider: 'local' }
  │◄──────────────────────────────┤
  │                               ├── capability:executing { tool: 'open_application' }
  │◄──────────────────────────────┤
  │                               ├── capability:result { success: true }
  │◄──────────────────────────────┤
  │                               ├── message:stream { token: "Pronto" }
  │◄──────────────────────────────┤
  │                               ├── message:stream { token: ", abri" }
  │◄──────────────────────────────┤
  │                               ├── message:stream { token: " o Chrome." }
  │◄──────────────────────────────┤
  │                               ├── message:complete { message: {...} }
  │◄──────────────────────────────┤
  │                               ├── state:change { state: 'idle' }
  │◄──────────────────────────────┤
```

---

## Autenticacao

Para V1 (uso pessoal), sem autenticacao — o Jarvis roda na rede local.

Para V3 (Mini PC), adicionar autenticacao simples:
- Token estatico configuravel
- Ou mTLS para conexoes na rede local
