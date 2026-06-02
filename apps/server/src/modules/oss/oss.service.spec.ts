// OssService 单元测试 — V2.0 S6 改造后通过 IStorageProvider 抽象访问对象存储
// ============================================================================
// 旧版直接 mock minio.Client; S6 后 OssService 改为依赖注入 IStorageProvider,
// spec 改为 provide 一个 mock IStorageProvider 实例。
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { OssService } from './oss.service';
import {
  IStorageProvider,
  STORAGE_PROVIDER,
  PutObjectInput,
  PutObjectResult,
  GetSignedUrlInput,
} from '../../integrations/storage/storage.interface';

describe('OssService', () => {
  let service: OssService;
  let mockStorage: jest.Mocked<IStorageProvider>;

  beforeEach(async () => {
    mockStorage = {
      put: jest.fn(),
      getSignedUrl: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    } as unknown as jest.Mocked<IStorageProvider>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OssService,
        { provide: STORAGE_PROVIDER, useValue: mockStorage },
      ],
    }).compile();
    service = module.get<OssService>(OssService);
  });

  // ── upload ─────────────────────────────────────────────────────────

  describe('upload', () => {
    it('should call storage.put with key/body/contentType and return url', async () => {
      const expectedRes: PutObjectResult = {
        key: 'media/test.png',
        url: 'http://minio.local/wxgzh/media/test.png',
        etag: 'mock-etag',
      };
      mockStorage.put.mockResolvedValue(expectedRes);

      const result = await service.upload('media/test.png', Buffer.from('hi'), 'image/png');

      const callArg = mockStorage.put.mock.calls[0]![0] as PutObjectInput;
      expect(callArg.key).toBe('media/test.png');
      expect(callArg.contentType).toBe('image/png');
      expect(Buffer.isBuffer(callArg.body)).toBe(true);
      expect(result).toBe(expectedRes.url);
    });

    it('should propagate storage.put errors', async () => {
      mockStorage.put.mockRejectedValue(new Error('S3 unreachable'));
      await expect(
        service.upload('docs/a.txt', Buffer.from('x'), 'text/plain'),
      ).rejects.toThrow('S3 unreachable');
    });
  });

  // ── getUrl ─────────────────────────────────────────────────────────

  describe('getUrl', () => {
    it('should call storage.getSignedUrl with default 3600s and return url', async () => {
      mockStorage.getSignedUrl.mockResolvedValue('http://signed.example/avatars/u1.jpg?sig=x');
      const url = await service.getUrl('avatars/u1.jpg');
      const arg = mockStorage.getSignedUrl.mock.calls[0]![0] as GetSignedUrlInput;
      expect(arg.key).toBe('avatars/u1.jpg');
      expect(arg.expiresInSec).toBe(3600);
      expect(url).toContain('avatars/u1.jpg');
    });

    it('should pass custom expiresInSec to storage.getSignedUrl', async () => {
      mockStorage.getSignedUrl.mockResolvedValue('http://signed/k?sig=x');
      await service.getUrl('k', 60);
      const arg = mockStorage.getSignedUrl.mock.calls[0]![0] as GetSignedUrlInput;
      expect(arg.expiresInSec).toBe(60);
    });
  });

  // ── delete ─────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should call storage.delete with the given key', async () => {
      mockStorage.delete.mockResolvedValue(undefined);
      await service.delete('media/old.png');
      expect(mockStorage.delete).toHaveBeenCalledWith('media/old.png');
    });
  });

  // ── exists ─────────────────────────────────────────────────────────

  describe('exists', () => {
    it('should return true when storage.exists resolves true', async () => {
      mockStorage.exists.mockResolvedValue(true);
      expect(await service.exists('a/b')).toBe(true);
    });
    it('should return false when storage.exists resolves false', async () => {
      mockStorage.exists.mockResolvedValue(false);
      expect(await service.exists('a/b')).toBe(false);
    });
  });
});
