// test/e2e/helpers/e2e-app.ts
// 启动 NestJS app (mock STORAGE_PROVIDER, 复用真实 DB/Redis)
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { STORAGE_PROVIDER } from '../../../src/integrations/storage/storage.interface';

let app: INestApplication | undefined;

export async function getE2EApp(): Promise<INestApplication> {
  if (app) return app;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(STORAGE_PROVIDER)
    .useValue({
      put: jest.fn().mockResolvedValue({ key: 'mock', url: 'mock://x', etag: 'e' }),
      getSignedUrl: jest.fn().mockResolvedValue('mock://signed'),
      delete: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true),
    })
    .compile();
  app = moduleRef.createNestApplication();
  // 必须与 main.ts:39 setGlobalPrefix 保持一致, 否则 E2E 调 /api/v1/* 全 404
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

export async function closeE2EApp(): Promise<void> {
  if (app) {
    await app.close();
    app = undefined;
  }
}
