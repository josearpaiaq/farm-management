import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

// Dedicated pg pool for the session store; Prisma manages its own connections.
@Injectable()
export class SessionPoolService implements OnModuleDestroy {
  readonly pool: Pool;

  constructor(config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      max: 5,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
