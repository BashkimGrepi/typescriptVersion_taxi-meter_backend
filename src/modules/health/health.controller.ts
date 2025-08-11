import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get('db')
  async db() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }
}
