import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * REST API pra lembretes — usado pelo painel visual do frontend.
 */
@Controller('api/reminders')
export class RemindersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    return this.prisma.reminder.findMany({
      orderBy: { dueAt: 'asc' },
      take: 50,
    });
  }

  @Post()
  async create(@Body() body: { title: string; dueAt?: string; description?: string }) {
    const dueAt = body.dueAt ? new Date(body.dueAt) : new Date(Date.now() + 60 * 60000);
    return this.prisma.reminder.create({
      data: {
        title: body.title,
        description: body.description,
        dueAt,
      },
    });
  }

  @Patch(':id/complete')
  async complete(@Param('id') id: string) {
    return this.prisma.reminder.update({
      where: { id },
      data: { completed: true },
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.prisma.reminder.delete({ where: { id } });
  }
}
