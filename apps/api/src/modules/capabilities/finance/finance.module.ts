import { Module } from '@nestjs/common';
import { FinanceCapability } from './finance.capability';

@Module({
  providers: [FinanceCapability],
  exports: [FinanceCapability],
})
export class FinanceModule {}
