import { Module } from '@nestjs/common';
import { RemindersCapability } from './reminders.capability';

@Module({
  providers: [RemindersCapability],
  exports: [RemindersCapability],
})
export class RemindersModule {}
