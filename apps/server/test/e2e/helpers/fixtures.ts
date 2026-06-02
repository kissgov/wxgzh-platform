// test/e2e/helpers/fixtures.ts
// supertest HTTP 助手 + JWT token 工具
import * as request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { getE2EApp } from './e2e-app';

export function makeToken(
  userId: string,
  tenantId: string,
  roles: string[] = ['tenant_owner'],
  permissions: string[] = ['*'],
): string {
  return jwt.sign(
    { sub: userId, tenantId, roles, permissions },
    process.env['JWT_SECRET'] || 'test-secret',
    { expiresIn: '1h' },
  );
}

export async function httpGet(path: string, token?: string) {
  const app = await getE2EApp();
  const req = request(app.getHttpServer()).get(path);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req;
}

export async function httpPost(path: string, body: unknown, token?: string) {
  const app = await getE2EApp();
  const req = request(app.getHttpServer()).post(path).send(body);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req;
}

export async function httpPut(path: string, body: unknown, token?: string) {
  const app = await getE2EApp();
  const req = request(app.getHttpServer()).put(path).send(body);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req;
}

export async function httpDelete(path: string, token?: string) {
  const app: INestApplication = await getE2EApp();
  const req = request(app.getHttpServer()).delete(path);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req;
}
