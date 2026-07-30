import { Module } from '@nestjs/common';
import { ConversationGateway } from './conversation.gateway';
import { ConversationService } from './conversation.service';
import { ConversationRepository } from './conversation.repository';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  providers: [ConversationGateway, ConversationService, ConversationRepository],
})
export class ConversationModule {}
