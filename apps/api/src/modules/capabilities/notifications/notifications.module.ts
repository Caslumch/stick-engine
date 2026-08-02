import { Module } from '@nestjs/common';
import { NotificationsCapability } from './notifications.capability';

@Module({
  providers: [NotificationsCapability],
  exports: [NotificationsCapability],
})
export class NotificationsModule {}
