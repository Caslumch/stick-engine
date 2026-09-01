import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { CapabilitiesModule } from './modules/capabilities/capabilities.module';
import { ComputerModule } from './modules/capabilities/computer/computer.module';
import { SearchModule } from './modules/capabilities/search/search.module';
import { RemindersModule } from './modules/capabilities/reminders/reminders.module';
import { NotificationsModule } from './modules/capabilities/notifications/notifications.module';
import { FinanceModule } from './modules/capabilities/finance/finance.module';
import { HomeModule } from './modules/capabilities/home/home.module';
import { SpotifyModule } from './modules/capabilities/spotify/spotify.module';
import { SettingsModule } from './modules/settings/settings.module';
import { MemoryModule } from './modules/memory/memory.module';
import { McpModule } from './modules/mcp/mcp.module';
import { LogsController } from './modules/logs/logs.controller';
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
    FinanceModule,
    HomeModule,
    SpotifyModule,
    MemoryModule,
    McpModule,
    ConversationModule,
  ],
  controllers: [LogsController],
})
export class AppModule {}
