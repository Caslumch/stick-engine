import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { MemoryRepository } from './memory.repository';
import { EmbeddingService } from './embedding.service';

@Module({
  providers: [MemoryService, MemoryRepository, EmbeddingService],
  exports: [MemoryService],
})
export class MemoryModule {}
