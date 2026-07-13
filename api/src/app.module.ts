import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AnimalsModule } from './animals/animals.module';
import { AuthModule } from './auth/auth.module';
import { BreedsModule } from './breeds/breeds.module';
import { FarmsModule } from './farms/farms.module';
import { CsrfGuard } from './common/guards/csrf.guard';
import { SessionAuthGuard } from './common/guards/session-auth.guard';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SessionPoolService } from './session/session-pool.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Base rate limit; only routes that opt in with ThrottlerGuard use it.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    PrismaModule,
    AuthModule,
    FarmsModule,
    BreedsModule,
    AnimalsModule,
  ],
  controllers: [HealthController],
  providers: [
    SessionPoolService,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
