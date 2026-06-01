// AuthService 单元测试 — 登录 / 注册 / Token 刷新
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

// Mock Prisma
const mockPrisma = {
  user: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction: jest.fn().mockImplementation((fn: any) => fn(mockPrisma)),
  tenant: { create: jest.fn(), findUnique: jest.fn() },
  role: { create: jest.fn() },
  userRole: { create: jest.fn() },
};

// Mock JWT
const mockJwt = { sign: jest.fn(), verify: jest.fn() };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── 登录 ──────────────────────────────────────────────────────────

  describe('login', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.login('test@test.com', 'password')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      const hash = await bcrypt.hash('correct-password', 12);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'test@test.com',
        tenantId: 't1',
        passwordHash: hash,
        status: 'active',
        userRoles: [],
      });

      await expect(service.login('test@test.com', 'wrong-password')).rejects.toThrow(UnauthorizedException);
    });

    it('should return access token and user info on success', async () => {
      const hash = await bcrypt.hash('password', 12);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'test@test.com',
        tenantId: 't1',
        passwordHash: hash,
        status: 'active',
        userRoles: [],
      });
      mockJwt.sign.mockReturnValue('access-token-xxx');
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 't1',
        name: 'Test Tenant',
        slug: 'test',
      });

      const result = await service.login('test@test.com', 'password');

      expect(result).toBeDefined();
      expect(result.access_token).toBe('access-token-xxx');
      expect(result.user.email).toBe('test@test.com');
    });
  });

  // ── 注册 ──────────────────────────────────────────────────────────

  describe('register', () => {
    it('should throw ConflictException when email exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({ name: 'Test', email: 'test@test.com', password: '123456', company: 'ACME' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create tenant + user on success', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockJwt.sign.mockReturnValue('token-xxx');
      mockPrisma.tenant.create.mockResolvedValue({
        id: 't-new', name: 'ACME', slug: 'acme', status: 'active',
      });
      mockPrisma.role.create.mockResolvedValue({ id: 'r-new' });
      mockPrisma.user.create.mockResolvedValue({
        id: 'u-new', email: 'test@test.com', name: 'Test',
      });
      mockPrisma.userRole.create.mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn(mockPrisma);
      });

      const result = await service.register({
        name: 'Test', email: 'test@test.com', password: '123456', company: 'ACME',
      });

      expect(result.access_token).toBeDefined();
      expect(result.user.email).toBe('test@test.com');
      expect(result.tenant.name).toBe('ACME');
    });
  });

  // ── Token 刷新 ────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('should return new tokens on valid refresh token', async () => {
      mockJwt.verify.mockReturnValue({
        sub: 'u1', tenantId: 't1', roles: ['admin'], permissions: [],
      });
      mockJwt.sign.mockReturnValue('new-token-xxx');

      const result = await service.refreshToken('valid-refresh-token');

      expect(result.access_token).toBe('new-token-xxx');
      expect(result.refresh_token).toBeDefined();
    });

    it('should throw UnauthorizedException on invalid token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
