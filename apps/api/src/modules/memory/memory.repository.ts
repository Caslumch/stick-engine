import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { MemoryType, MemorySource } from '@jarvis/shared';

export interface CreateMemoryData {
  type: MemoryType;
  content: string;
  source: MemorySource;
  embedding?: number[];
}

@Injectable()
export class MemoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateMemoryData) {
    if (data.embedding) {
      const vectorStr = `[${data.embedding.join(',')}]`;
      const result = await this.prisma.$queryRaw<any[]>`
        INSERT INTO "Memory" (id, type, content, source, embedding, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${data.type},
          ${data.content},
          ${data.source},
          ${vectorStr}::vector,
          NOW(),
          NOW()
        )
        RETURNING id, type, content, source, "createdAt", "updatedAt"
      `;
      return result[0];
    }

    return this.prisma.$queryRaw<any[]>`
      INSERT INTO "Memory" (id, type, content, source, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid()::text,
        ${data.type},
        ${data.content},
        ${data.source},
        NOW(),
        NOW()
      )
      RETURNING id, type, content, source, "createdAt", "updatedAt"
    `.then((r) => r[0]);
  }

  async findAll(type?: MemoryType) {
    if (type) {
      return this.prisma.$queryRaw<any[]>`
        SELECT id, type, content, source, "createdAt", "updatedAt"
        FROM "Memory"
        WHERE type = ${type}
        ORDER BY "updatedAt" DESC
      `;
    }
    return this.prisma.$queryRaw<any[]>`
      SELECT id, type, content, source, "createdAt", "updatedAt"
      FROM "Memory"
      ORDER BY "updatedAt" DESC
    `;
  }

  async findById(id: string) {
    const results = await this.prisma.$queryRaw<any[]>`
      SELECT id, type, content, source, "createdAt", "updatedAt"
      FROM "Memory"
      WHERE id = ${id}
    `;
    return results[0] ?? null;
  }

  async update(id: string, content: string, embedding?: number[]) {
    if (embedding) {
      const vectorStr = `[${embedding.join(',')}]`;
      return this.prisma.$queryRaw<any[]>`
        UPDATE "Memory"
        SET content = ${content}, embedding = ${vectorStr}::vector, "updatedAt" = NOW()
        WHERE id = ${id}
        RETURNING id, type, content, source, "createdAt", "updatedAt"
      `.then((r) => r[0]);
    }

    return this.prisma.$queryRaw<any[]>`
      UPDATE "Memory"
      SET content = ${content}, "updatedAt" = NOW()
      WHERE id = ${id}
      RETURNING id, type, content, source, "createdAt", "updatedAt"
    `.then((r) => r[0]);
  }

  async delete(id: string) {
    await this.prisma.$queryRaw`DELETE FROM "Memory" WHERE id = ${id}`;
  }

  // threshold 0.30: com text-embedding-3-small, fatos curtos ("Mora em Barueri")
  // pontuam ~0.41 contra perguntas relacionadas ("onde eu moro?"). O valor
  // anterior (0.7) descartava praticamente toda memoria real.
  async searchByEmbedding(embedding: number[], limit = 5, threshold = 0.3) {
    const vectorStr = `[${embedding.join(',')}]`;
    return this.prisma.$queryRaw<any[]>`
      SELECT id, type, content, source, "createdAt", "updatedAt",
             1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM "Memory"
      WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> ${vectorStr}::vector) > ${threshold}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `;
  }
}
