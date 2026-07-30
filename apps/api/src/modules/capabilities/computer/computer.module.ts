import { Module } from '@nestjs/common';
import { ComputerCapability } from './computer.capability';

@Module({
  providers: [ComputerCapability],
  exports: [ComputerCapability],
})
export class ComputerModule {}
