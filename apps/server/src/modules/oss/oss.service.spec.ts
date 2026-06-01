// OssService 单元测试 — MinIO 上传 / URL 生成 / 删除
// ============================================================================
// OssService 在 constructor 里 new Minio.Client(), 所以必须 mock 掉 minio
// 模块, 避免真连; bucketExists 默认 true 跳过 makeBucket 分支。
// ============================================================================
jest.mock('minio', () => {
  const mockClient = {
    bucketExists: jest.fn(),
    makeBucket: jest.fn(),
    putObject: jest.fn(),
    removeObject: jest.fn(),
    presignedGetObject: jest.fn(),
  };
  return {
    Client: jest.fn().mockImplementation(() => mockClient),
    __mockClient: mockClient,
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { OssService } from './oss.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Minio = require('minio');
const mockClient = Minio.__mockClient;

describe('OssService', () => {
  let service: OssService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // 默认 bucketExists = true (跳过 makeBucket 分支)
    mockClient.bucketExists.mockResolvedValue(true);
    const module: TestingModule = await Test.createTestingModule({
      providers: [OssService],
    }).compile();
    service = module.get<OssService>(OssService);
  });

  // ── upload ─────────────────────────────────────────────────────────

  describe('upload', () => {
    it('should putObject with contentType and return access URL', async () => {
      mockClient.putObject.mockResolvedValue({ etag: 'mock-etag' });

      const result = await service.upload('media/test.png', Buffer.from('hi'), 'image/png');

      expect(mockClient.putObject).toHaveBeenCalledWith(
        expect.any(String), // bucket
        'media/test.png',
        expect.any(Buffer),
        expect.any(Number),
        expect.objectContaining({ 'Content-Type': 'image/png' }),
      );
      // 返回值是 http(s)://endpoint:port/bucket/objectName 形式的 URL
      expect(result).toMatch(/^https?:\/\/.+\/wxgzh-materials\/media\/test\.png$/);
    });

    it('should create bucket when it does not exist', async () => {
      mockClient.bucketExists.mockResolvedValue(false);
      mockClient.makeBucket.mockResolvedValue(undefined);
      mockClient.putObject.mockResolvedValue({ etag: 'mock-etag' });

      await service.upload('docs/a.txt', Buffer.from('x'), 'text/plain');

      expect(mockClient.makeBucket).toHaveBeenCalledTimes(1);
      expect(mockClient.putObject).toHaveBeenCalledTimes(1);
    });
  });

  // ── getUrl ─────────────────────────────────────────────────────────

  describe('getUrl', () => {
    it('should build a public URL with bucket and object name', async () => {
      const url = await service.getUrl('avatars/u1.jpg');
      expect(url).toMatch(/avatars\/u1\.jpg$/);
      expect(url).toContain('wxgzh-materials');
    });
  });

  // ── delete ─────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should call removeObject with bucket and object name', async () => {
      mockClient.removeObject.mockResolvedValue(undefined);

      await service.delete('media/old.png');

      expect(mockClient.removeObject).toHaveBeenCalledWith(
        expect.any(String),
        'media/old.png',
      );
    });
  });
});
