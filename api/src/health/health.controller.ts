import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: string }> {
    // Fails with a 500 if the database is unreachable.
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
