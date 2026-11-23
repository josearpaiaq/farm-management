import {
  INestApplication,
  UnprocessableEntityException,
  ValidationError,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';
import {
  FieldError,
  HttpExceptionFilter,
} from './common/filters/http-exception.filter';

// Flattens class-validator errors (including nested DTOs) into field paths.
function toFieldErrors(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints
      ? [{ field, message: Object.values(error.constraints).join('; ') }]
      : [];
    return [...own, ...toFieldErrors(error.children ?? [], field)];
  });
}

// Single place for app-wide HTTP configuration, shared by main.ts and e2e
// tests so both always exercise the same setup.
//
// URI versioning: routes resolve to /api/v1/... by default. A future v2 of an
// endpoint is added with @Version('2') on the new controller/handler — both
// versions are served side by side; nothing here changes.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) =>
        new UnprocessableEntityException({
          message: 'Validation failed',
          details: toFieldErrors(errors),
        }),
    }),
  );

  // Parses the refresh token cookie used by web clients (see AuthController).
  app.use(cookieParser());
}
