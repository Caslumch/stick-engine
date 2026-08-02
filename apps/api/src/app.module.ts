import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { CapabilitiesModule } from './modules/capabilities/capabilities.module';
import { ComputerModule } from './modules/capabilities/computer/computer.module';
import { SettingsModule } from './modules/settings/settings.module';
import { MemoryModule } from './modules/memory/memory.module';
import { jarvisConfig } from './config/jarvis.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jarvisConfig],
    }),
    PrismaModule,
    SettingsModule,
    CapabilitiesModule,
    ComputerModule,
    MemoryModule,
    ConversationModule,
  ],
})
export class AppModule {}
