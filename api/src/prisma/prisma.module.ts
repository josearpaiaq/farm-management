import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global: the data-access layer is needed by every feature module.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
