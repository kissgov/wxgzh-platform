// JWT 测试 helper — 在 e2e/集成测试里生成合法 JWT 注入到 Authorization 头
// ============================================================================
// 用 @nestjs/jwt 的 JwtService (V1 已装), 避免引入额外 jsonwebtoken 依赖。
// 与生产 AuthService 保持同一签名算法 (默认 HS256)。
// ============================================================================
import { JwtService } from '@nestjs/jwt';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const jwtService = new JwtService({ secret: SECRET });

export interface JwtPayload {
  sub: string;        // userId
  tenantId: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * 生成一个 1h 过期的 access token。
 */
export function makeJwt(payload: JwtPayload): string {
  return jwtService.sign(payload, { expiresIn: '1h' });
}

/**
 * 生成 Bearer Authorization header, 可直接 spread 进 supertest.set()。
 *
 *   request(app).get('/x').set(authHeader(userId, tenantId))
 */
export function authHeader(
  userId: string,
  tenantId: string,
  roles: string[] = ['tenant_owner'],
): Record<string, string> {
  return {
    Authorization: `Bearer ${makeJwt({ sub: userId, tenantId, roles })}`,
  };
}
