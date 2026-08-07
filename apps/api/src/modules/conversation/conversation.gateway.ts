import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsEvent } from '@jarvis/shared';
import type { MessageSendPayload, JarvisState, MessageFillerPayload, IntentClassification, IntentType } from '@jarvis/shared';
import { ConversationService } from './conversation.service';
import { SettingsService } from '../settings/settings.service';
import { MemoryService } from '../memory/memory.service';
import { RemindersCapability } from '../capabilities/reminders/reminders.capability';
import { McpService } from '../mcp/mcp.service';

const FILLERS_BY_INTENT: Record<IntentType, string[]> = {
  information: ['Deixa eu ver...', 'Boa pergunta...', 'Hmm, deixa eu pensar...', 'Vou verificar...'],
  action: ['Certo, vou fazer isso...', 'Só um instante...', 'Preparando...', 'Já vou executar...'],
  conversation: [''],  // No filler for casual chat — feels more natural
  confirmation: ['Entendido...', 'Certo...'],
  memory: ['Anotando...', 'Guardando isso...'],
};

function pickFiller(intent: IntentType): string {
  const fillers = FILLERS_BY_INTENT[intent] ?? FILLERS_BY_INTENT.information;
  const valid = fillers.filter(Boolean);
  if (valid.length === 0) return '';
  return valid[Math.floor(Math.random() * valid.length)];
}

@WebSocketGateway({ cors: { origin: '*' } })
export class ConversationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ConversationGateway.name);
  private state: JarvisState = 'idle';

  constructor(
    private readonly conversationService: ConversationService,
    private readonly settingsService: SettingsService,
    private readonly memoryService: MemoryService,
    private readonly reminders: RemindersCapability,
    private readonly mcp: McpService,
  ) {
    // Wire up reminder notifications to broadcast via WebSocket
    this.reminders.onNotification = (reminder) => {
      this.server?.emit(WsEvent.ReminderDue, reminder);
    };
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit(WsEvent.StateChange, { state: this.state });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Deduplicação: evitar processar a mesma mensagem 2x (WebSocket reconecta)
  private lastMessageHash = '';
  private lastMessageTime = 0;

  @SubscribeMessage(WsEvent.MessageSend)
  async handleMessage(
    @MessageBody() payload: MessageSendPayload,
    @ConnectedSocket() client: Socket,
  ) {
    // Dedup: ignorar mensagem idêntica nos últimos 5 segundos
    const hash = payload.text + (payload.conversationId || '');
    const now = Date.now();
    if (hash === this.lastMessageHash && now - this.lastMessageTime < 5000) {
      this.logger.debug(`Mensagem duplicada ignorada: "${payload.text.slice(0, 30)}"`);
      return;
    }
    this.lastMessageHash = hash;
    this.lastMessageTime = now;

    let conversationId: string;
    if (payload.conversationId) {
      conversationId = payload.conversationId;
    } else {
      const conversation = await this.conversationService.createConversation();
      conversationId = conversation.id;
    }

    // Classify intent first
    const intent = this.conversationService.classifyIntent(payload.text);

    // --- FAST PATH: resolver sem LLM (~10ms) ---
    const fastResponse = await this.conversationService.tryFastPath(payload.text, intent);
    if (fastResponse) {
      this.logger.log(`Fast-path: "${payload.text.slice(0, 40)}" → "${fastResponse.slice(0, 40)}"`);
      this.emitStateChange('speaking');

      // Persistir mensagens
      const repo = this.conversationService;
      const msg = await (repo as any).repository.addMessage(conversationId, { role: 'user', content: payload.text });
      const assistantMsg = await (repo as any).repository.addMessage(conversationId, { role: 'assistant', content: fastResponse });

      // Stream a resposta token por token (pra manter consistência)
      for (const word of fastResponse.split(' ')) {
        client.emit(WsEvent.MessageStream, { token: word + ' ', conversationId });
      }

      client.emit(WsEvent.MessageComplete, {
        message: {
          id: assistantMsg.id,
          conversationId,
          role: 'assistant',
          content: fastResponse,
          provider: 'fast-path',
          model: 'heuristic',
          createdAt: assistantMsg.createdAt.toISOString(),
        },
        conversationId,
      });

      this.emitStateChange('idle');
      return;
    }

    // --- SLOW PATH: LLM ---
    const filler = pickFiller(intent.intent);
    this.emitStateChange('thinking', filler || undefined);

    if (filler) {
      client.emit(WsEvent.MessageFiller, {
        text: filler,
        conversationId,
      } satisfies MessageFillerPayload);
    }

    try {
      const message = await this.conversationService.handleMessage(
        conversationId,
        payload.text,
        (token) => {
          client.emit(WsEvent.MessageStream, { token, conversationId });
        },
        (decision) => {
          client.emit(WsEvent.DecisionMade, decision);
        },
        (toolEvent) => {
          if (toolEvent.result) {
            client.emit(WsEvent.CapabilityResult, {
              toolName: toolEvent.toolName,
              result: toolEvent.result,
              conversationId,
            });
          } else {
            client.emit(WsEvent.CapabilityExecuting, {
              toolName: toolEvent.toolName,
              args: toolEvent.args,
              conversationId,
            });
          }
        },
        (classifiedIntent) => {
          client.emit(WsEvent.IntentClassified, classifiedIntent);
        },
      );

      client.emit(WsEvent.MessageComplete, {
        message: {
          id: message.id,
          conversationId,
          role: message.role,
          content: message.content,
          provider: message.provider,
          model: message.model,
          createdAt: message.createdAt.toISOString(),
        },
        conversationId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Message handling failed: ${errorMessage}`);

      client.emit(WsEvent.MessageError, {
        error: errorMessage,
        conversationId,
      });
    } finally {
      this.emitStateChange('idle');
    }
  }

  @SubscribeMessage(WsEvent.StateGet)
  handleStateGet() {
    return { state: this.state };
  }

  @SubscribeMessage(WsEvent.ConversationList)
  async handleConversationList() {
    return this.conversationService.listConversations();
  }

  @SubscribeMessage(WsEvent.ConversationCreate)
  async handleConversationCreate() {
    return this.conversationService.createConversation();
  }

  @SubscribeMessage(WsEvent.ConversationMessages)
  async handleConversationMessages(@MessageBody() payload: { conversationId: string }) {
    const conv = await this.conversationService.getConversation(payload.conversationId);
    if (!conv) return [];
    return conv.messages?.map((m: any) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      provider: m.provider,
      model: m.model,
      createdAt: m.createdAt.toISOString?.() ?? m.createdAt,
    })) ?? [];
  }

  @SubscribeMessage(WsEvent.ConversationDelete)
  async handleConversationDelete(@MessageBody() payload: { conversationId: string }) {
    await this.conversationService.deleteConversation(payload.conversationId);
    return { success: true };
  }

  @SubscribeMessage(WsEvent.SettingsGet)
  async handleSettingsGet() {
    return this.settingsService.getAllSafe();
  }

  @SubscribeMessage(WsEvent.SettingsUpdate)
  async handleSettingsUpdate(@MessageBody() payload: { key: string; value: string }) {
    await this.settingsService.set(payload.key, payload.value);
    return { success: true };
  }

  @SubscribeMessage(WsEvent.MemoryList)
  async handleMemoryList(@MessageBody() payload?: { type?: string }) {
    return this.memoryService.list(payload?.type as any);
  }

  @SubscribeMessage(WsEvent.MemorySave)
  async handleMemorySave(@MessageBody() payload: { content: string; type: string }) {
    return this.memoryService.save(payload.content, payload.type as any, 'explicit');
  }

  @SubscribeMessage(WsEvent.MemoryDelete)
  async handleMemoryDelete(@MessageBody() payload: { id: string }) {
    await this.memoryService.delete(payload.id);
    return { success: true };
  }

  @SubscribeMessage(WsEvent.MemorySearch)
  async handleMemorySearch(@MessageBody() payload: { query: string; limit?: number }) {
    return this.memoryService.search(payload.query, payload.limit);
  }

  // ── MCP ───────────────────────────────────────────────────

  @SubscribeMessage(WsEvent.McpList)
  async handleMcpList() {
    return this.mcp.listServers();
  }

  @SubscribeMessage(WsEvent.McpAdd)
  async handleMcpAdd(@MessageBody() payload: {
    name: string;
    transport: string;
    command?: string;
    args?: string;
    url?: string;
    apiKey?: string;
  }) {
    return this.mcp.addServer(payload);
  }

  @SubscribeMessage(WsEvent.McpUpdate)
  async handleMcpUpdate(@MessageBody() payload: {
    id: string;
    name?: string;
    transport?: string;
    command?: string;
    args?: string;
    url?: string;
    enabled?: boolean;
  }) {
    const { id, ...data } = payload;
    return this.mcp.updateServer(id, data);
  }

  @SubscribeMessage(WsEvent.McpRemove)
  async handleMcpRemove(@MessageBody() payload: { id: string }) {
    await this.mcp.removeServer(payload.id);
    return { success: true };
  }

  @SubscribeMessage(WsEvent.McpReconnect)
  async handleMcpReconnect(@MessageBody() payload: { id: string }) {
    return this.mcp.reconnect(payload.id);
  }

  private emitStateChange(state: JarvisState, filler?: string) {
    this.state = state;
    this.server.emit(WsEvent.StateChange, { state, filler });
  }
}
