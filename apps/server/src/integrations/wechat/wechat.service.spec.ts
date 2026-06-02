// WechatService 单元测试 — Token 缓存/锁/重试/各类 API 包装
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { WechatService } from './wechat.service';
import { PrismaService } from '../../prisma/prisma.service';

// 在文件顶部 mock ioredis — WechatService 在构造函数里 new Redis(),
// 用 jest.mock 在模块加载时拦截, 比 mid-test 覆盖更稳。
jest.mock('ioredis', () => {
  // 单例 fake redis: 测试里通过 __setFake() 切换实现
  const fake: any = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    disconnect: jest.fn(),
  };
  const RedisMock = jest.fn().mockImplementation(() => fake);
  return { Redis: RedisMock, __fake: fake, __RedisMock: RedisMock };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ioredisMock = require('ioredis');

const mockPrisma: any = {
  componentApp: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  authorizer: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('WechatService', () => {
  let service: WechatService;
  let redisSet: jest.Mock;
  let redisGet: jest.Mock;
  let redisDel: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    // 重置 ioredis fake mock 状态
    redisSet = ioredisMock.__fake.set as jest.Mock;
    redisGet = ioredisMock.__fake.get as jest.Mock;
    redisDel = ioredisMock.__fake.del as jest.Mock;
    redisSet.mockReset();
    redisGet.mockReset();
    redisDel.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WechatService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<WechatService>(WechatService);
  });

  // ── Component Token ─────────────────────────────────────────────

  describe('Component Token', () => {
    it('should return cached component token if Redis hit', async () => {
      redisGet.mockResolvedValue('cached_token');

      const token = await service.getComponentToken('app-1');

      expect(token).toBe('cached_token');
      expect(redisGet).toHaveBeenCalledWith('token:component:app-1');
      // 关键: 命中缓存就不应该再调 prisma
      expect(mockPrisma.componentApp.findUnique).not.toHaveBeenCalled();
    });

    it('should invalidate component token (Redis del)', async () => {
      redisDel.mockResolvedValue(1);
      await service.invalidateComponentToken('app-1');
      expect(redisDel).toHaveBeenCalledWith('token:component:app-1');
    });

    it('should set ticket and bust cache', async () => {
      mockPrisma.componentApp.update.mockResolvedValue({});
      redisDel.mockResolvedValue(1);

      await service.setTicket('app-1', 'new-ticket');

      expect(mockPrisma.componentApp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1' },
          data: { verifyTicket: 'new-ticket' },
        }),
      );
      expect(redisDel).toHaveBeenCalledWith('token:component:app-1');
    });
  });

  // ── Authorizer Token ────────────────────────────────────────────

  describe('Authorizer Token', () => {
    it('should return cached authorizer token if Redis hit', async () => {
      redisGet.mockResolvedValue('cached_auth_token');

      const token = await service.getAuthorizerToken('auth-1');

      expect(token).toBe('cached_auth_token');
      expect(redisGet).toHaveBeenCalledWith('token:authorizer:auth-1');
      expect(mockPrisma.authorizer.findUnique).not.toHaveBeenCalled();
    });

    it('should invalidate authorizer token (Redis del + DB expireAt=0)', async () => {
      redisDel.mockResolvedValue(1);
      mockPrisma.authorizer.update.mockResolvedValue({});

      await service.invalidateAuthorizerToken('auth-1');

      expect(redisDel).toHaveBeenCalledWith('token:authorizer:auth-1');
      expect(mockPrisma.authorizer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { tokenExpireAt: new Date(0) },
        }),
      );
    });
  });

  // ── 高阶 API 包装 ───────────────────────────────────────────────

  describe('Data cube + follower API wrappers', () => {
    it('should call this.request with correct path for getFollowers', async () => {
      const spy = jest.spyOn(service, 'request' as any).mockResolvedValue({
        total: 0, count: 0, data: { openid: [] }, next_openid: '',
      });

      await service.getFollowers('a1', 'next-1');

      expect(spy).toHaveBeenCalledWith('a1', 'GET', '/cgi-bin/user/get', { next_openid: 'next-1' });
    });

    it('should call this.request with user_list for batchGetUserInfo', async () => {
      const spy = jest.spyOn(service, 'request' as any).mockResolvedValue({ user_info_list: [] });

      await service.batchGetUserInfo('a1', ['o1', 'o2']);

      expect(spy).toHaveBeenCalledWith('a1', 'POST', '/cgi-bin/user/info/batchget', {
        user_list: [{ openid: 'o1', lang: 'zh_CN' }, { openid: 'o2', lang: 'zh_CN' }],
      });
    });

    it.each([
      ['getUserSummary', '/datacube/getusersummary'],
      ['getUserCumulate', '/datacube/getusercumulate'],
      ['getArticleSummary', '/datacube/getarticlesummary'],
      ['getArticleTotal', '/datacube/getarticletotal'],
      ['getUpstreamMsg', '/datacube/getupstreammsg'],
      ['getUpstreamMsgDist', '/datacube/getupstreammsgdist'],
      ['getUpstreamMsgWeek', '/datacube/getupstreammsgweek'],
      ['getInterfaceSummary', '/datacube/getinterfacesummary'],
    ])('should dispatch %s to /%s', async (method, path) => {
      const spy = jest.spyOn(service, 'request' as any).mockResolvedValue({ list: [] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (service as any)[method]('a1', '2026-01-01', '2026-01-31');
      expect(spy).toHaveBeenCalledWith('a1', 'POST', path, {
        begin_date: '2026-01-01', end_date: '2026-01-31',
      });
    });
  });

  // ── lock 失败分支 (锁持有中) ─────────────────────────────────────

  describe('refresh path — lock contention', () => {
    it('refreshComponentToken should throw when lock cannot be acquired and cache still empty', async () => {
      redisGet.mockResolvedValue(null);   // 缓存空
      redisSet.mockResolvedValue(null);   // NX 失败 (锁被持有)

      await expect(service.refreshComponentToken('app-1'))
        .rejects.toThrow(InternalServerErrorException);
    });

    it('refreshAuthorizerToken should throw InternalServerErrorException when lock not acquired', async () => {
      redisGet.mockResolvedValue(null);
      redisSet.mockResolvedValue(null);

      await expect(service.refreshAuthorizerToken('auth-1'))
        .rejects.toThrow(InternalServerErrorException);
    });

    it('refreshComponentToken should throw if ComponentApp missing or verifyTicket empty', async () => {
      redisGet.mockResolvedValue(null);
      redisSet.mockResolvedValue('OK');  // 拿到锁
      mockPrisma.componentApp.findUnique.mockResolvedValue(null);

      await expect(service.refreshComponentToken('app-1'))
        .rejects.toThrow(InternalServerErrorException);
    });

    it('refreshAuthorizerToken should throw if Authorizer missing or refreshToken empty', async () => {
      redisGet.mockResolvedValue(null);
      redisSet.mockResolvedValue('OK');
      mockPrisma.authorizer.findUnique.mockResolvedValue(null);

      await expect(service.refreshAuthorizerToken('auth-1'))
        .rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── request() 错误处理 ──────────────────────────────────────────

  describe('request()', () => {
    it('should retry once on token-expired errcode (40001/40014/42001/61023)', async () => {
      jest.spyOn(service, 'getAuthorizerToken')
        .mockResolvedValueOnce('old_token')
        .mockResolvedValueOnce('new_token');
      jest.spyOn(service, 'invalidateAuthorizerToken').mockResolvedValue(undefined);

      const httpAny = (service as any).http;
      const reqSpy = jest.spyOn(httpAny, 'request')
        .mockResolvedValueOnce({ data: { errcode: 40001, errmsg: 'invalid token' } })
        .mockResolvedValueOnce({ data: { errcode: 0, errmsg: 'ok', content: 'retried' } });

      const result = await service.request('a1', 'GET', '/foo');

      expect(reqSpy).toHaveBeenCalledTimes(2);
      expect(service.invalidateAuthorizerToken).toHaveBeenCalledWith('a1');
      expect(result).toEqual({ errcode: 0, errmsg: 'ok', content: 'retried' });
    });

    it('should return data as-is when errcode is 0', async () => {
      jest.spyOn(service, 'getAuthorizerToken').mockResolvedValue('t');
      const httpAny = (service as any).http;
      jest.spyOn(httpAny, 'request').mockResolvedValue({ data: { errcode: 0, errmsg: 'ok' } });

      const result = await service.request('a1', 'POST', '/foo', { hello: 'world' });

      expect(result).toEqual({ errcode: 0, errmsg: 'ok' });
      const call = httpAny.request.mock.calls[0][0];
      expect(call.method).toBe('POST');
      expect(call.data).toEqual({ hello: 'world' });
    });
  });

  // ── requestComponent() ──────────────────────────────────────────

  describe('requestComponent()', () => {
    it('should throw Error on non-retryable errcode', async () => {
      jest.spyOn(service, 'getComponentToken').mockResolvedValue('t');
      const httpAny = (service as any).http;
      jest.spyOn(httpAny, 'request').mockResolvedValue({ data: { errcode: 40002, errmsg: 'bad' } });

      await expect(service.requestComponent('app-1', 'GET', '/foo'))
        .rejects.toThrow('微信 API 错误: [40002] bad');
    });

    it('should throw Error on retry if second response still has errcode', async () => {
      jest.spyOn(service, 'getComponentToken').mockResolvedValue('t');
      jest.spyOn(service, 'invalidateComponentToken').mockResolvedValue(undefined);
      const httpAny = (service as any).http;
      jest.spyOn(httpAny, 'request')
        .mockResolvedValueOnce({ data: { errcode: 42001, errmsg: 'expired' } })
        .mockResolvedValueOnce({ data: { errcode: 42001, errmsg: 'still expired' } });

      await expect(service.requestComponent('app-1', 'POST', '/bar'))
        .rejects.toThrow('微信 API 错误: [42001] still expired');
    });

    it('should retry on token-expired and return successful retry data', async () => {
      jest.spyOn(service, 'getComponentToken').mockResolvedValue('t');
      jest.spyOn(service, 'invalidateComponentToken').mockResolvedValue(undefined);
      const httpAny = (service as any).http;
      jest.spyOn(httpAny, 'request')
        .mockResolvedValueOnce({ data: { errcode: 40001, errmsg: 'expired' } })
        .mockResolvedValueOnce({ data: { errcode: 0, errmsg: 'ok', data: 'x' } });

      const result = await service.requestComponent('app-1', 'POST', '/bar');
      expect(result).toEqual({ errcode: 0, errmsg: 'ok', data: 'x' });
    });
  });
});
