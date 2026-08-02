import { Module } from '@nestjs/common';
import { SearchCapability } from './search.capability';

@Module({
  providers: [SearchCapability],
  exports: [SearchCapability],
})
export class SearchModule {}
