import { Module } from '@nestjs/common';
import { ConversationGateway } from './conversation.gateway';
import { ConversationService } from './conversation.service';
import { ConversationRepository } from './conversation.repository';
import { LlmModule } from '../llm/llm.module';
import { MemoryModule } from '../memory/memory.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [LlmModule, MemoryModule, SettingsModule],
  providers: [ConversationGateway, ConversationService, ConversationRepository],
})
export class ConversationModule {}
