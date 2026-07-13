import {
  HttpStatus,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { SessionPoolService } from './session/session-pool.service';

// Single place for app-wide HTTP configuration, shared by main.ts and e2e
// tests so both always exercise the same setup.
//
// URI versioning: routes resolve to /api/v1/... by default. A future v2 of an
// endpoint is added with @Version('2') on the new controller/handler — both
// versions are served side by side; nothing here changes.
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );

  // Server-side sessions in an httpOnly cookie, stored in the sessions table
  // (see db/schema.sql). sameSite=lax + CsrfGuard cover CSRF.
  const PgSessionStore = connectPgSimple(session);
  app.use(
    session({
      name: 'sid',
      store: new PgSessionStore({
        pool: app.get(SessionPoolService).pool,
        tableName: 'sessions',
      }),
      secret: config.getOrThrow<string>('SESSION_SECRET'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.get<string>('NODE_ENV') === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    }),
  );
}
