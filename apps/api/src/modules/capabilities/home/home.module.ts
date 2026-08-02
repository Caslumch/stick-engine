import { Module } from '@nestjs/common';
import { HomeCapability } from './home.capability';

@Module({
  providers: [HomeCapability],
  exports: [HomeCapability],
})
export class HomeModule {}
