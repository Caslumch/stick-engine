import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { CapabilitiesModule } from './modules/capabilities/capabilities.module';
import { ComputerModule } from './modules/capabilities/computer/computer.module';
import { SearchModule } from './modules/capabilities/search/search.module';
import { RemindersModule } from './modules/capabilities/reminders/reminders.module';
import { NotificationsModule } from './modules/capabilities/notifications/notifications.module';
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
    SearchModule,
    RemindersModule,
    NotificationsModule,
    MemoryModule,
    ConversationModule,
  ],
})
export class AppModule {}
