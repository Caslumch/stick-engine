import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(title?: string) {
    return this.prisma.conversation.create({
      data: { title: title ?? 'Nova conversa' },
    });
  }

  async findById(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async findAll(page = 1, limit = 20) {
    return this.prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { messages: true } } },
    });
  }

  async delete(id: string) {
    return this.prisma.conversation.delete({ where: { id } });
  }

  async updateTitle(id: string, title: string) {
    return this.prisma.conversation.update({
      where: { id },
      data: { title },
    });
  }

  async addMessage(conversationId: string, data: {
    role: string;
    content: string;
    provider?: string;
    model?: string;
    toolCalls?: Prisma.InputJsonValue;
  }) {
    return this.prisma.message.create({
      data: {
        conversationId,
        role: data.role,
        content: data.content,
        provider: data.provider,
        model: data.model,
        toolCalls: data.toolCalls ?? undefined,
      },
    });
  }

  async getMessages(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
