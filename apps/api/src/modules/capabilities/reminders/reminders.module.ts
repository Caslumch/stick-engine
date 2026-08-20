import { Module } from '@nestjs/common';
import { RemindersCapability } from './reminders.capability';
import { RemindersController } from './reminders.controller';

@Module({
  controllers: [RemindersController],
  providers: [RemindersCapability],
  exports: [RemindersCapability],
})
export class RemindersModule {}
