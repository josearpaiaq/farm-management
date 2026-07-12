import { INestApplication, VersioningType } from '@nestjs/common';

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
}
