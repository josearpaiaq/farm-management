import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { AnimalRecordsModule } from './animal-records/animal-records.module';
import { AnimalsModule } from './animals/animals.module';
import { AuthModule } from './auth/auth.module';
import { BreedsModule } from './breeds/breeds.module';
import { FarmsModule } from './farms/farms.module';
import { ImportsModule } from './imports/imports.module';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth/tokens.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // expandVariables resolves ${VAR} references, e.g. in DATABASE_URL.
    ConfigModule.forRoot({ isGlobal: true, expandVariables: true }),
    // Access tokens: HS256 JWTs signed with AUTH_SECRET (see TokensService).
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('AUTH_SECRET'),
        signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
      }),
    }),
    // Base rate limit; only routes that opt in with ThrottlerGuard use it.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    PrismaModule,
    AuthModule,
    FarmsModule,
    BreedsModule,
    AnimalsModule,
    AnimalRecordsModule,
    ImportsModule,
    // Production: serve the built web app from the same origin (so the
    // sameSite=strict refresh cookie works), falling back to index.html for
    // client-side routes. Unset in dev, where Vite serves the web.
    ...(process.env.WEB_DIST_DIR
      ? [
          ServeStaticModule.forRoot({
            rootPath: process.env.WEB_DIST_DIR,
            exclude: ['/api/{*path}'],
          }),
        ]
      : []),
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
