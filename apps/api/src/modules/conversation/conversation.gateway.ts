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
import type { MessageSendPayload, JarvisState } from '@jarvis/shared';
import { ConversationService } from './conversation.service';
import { SettingsService } from '../settings/settings.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ConversationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ConversationGateway.name);
  private state: JarvisState = 'idle';

  constructor(
    private readonly conversationService: ConversationService,
    private readonly settingsService: SettingsService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit(WsEvent.StateChange, { state: this.state });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(WsEvent.MessageSend)
  async handleMessage(
    @MessageBody() payload: MessageSendPayload,
    @ConnectedSocket() client: Socket,
  ) {
    let conversationId: string;
    if (payload.conversationId) {
      conversationId = payload.conversationId;
    } else {
      const conversation = await this.conversationService.createConversation();
      conversationId = conversation.id;
    }

    this.emitStateChange('thinking');

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

  @SubscribeMessage(WsEvent.SettingsGet)
  async handleSettingsGet() {
    return this.settingsService.getAllSafe();
  }

  @SubscribeMessage(WsEvent.SettingsUpdate)
  async handleSettingsUpdate(@MessageBody() payload: { key: string; value: string }) {
    await this.settingsService.set(payload.key, payload.value);
    return { success: true };
  }

  private emitStateChange(state: JarvisState) {
    this.state = state;
    this.server.emit(WsEvent.StateChange, { state });
  }
}
