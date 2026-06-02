// LocalStorageProvider 单元测试 — put/exists/getSignedUrl/delete 全链路
// ============================================================================
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { LocalStorageProvider } from './local.provider';

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wxgzh-storage-'));
    process.env['LOCAL_STORAGE_DIR'] = tmpDir;
    provider = new LocalStorageProvider();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('put 写入文件, exists 为 true', async () => {
    const buf = Buffer.from('hello world');
    const res = await provider.put({ key: 'test/hello.txt', body: buf, contentType: 'text/plain' });
    expect(res.key).toBe('test/hello.txt');
    expect(res.url).toMatch(/^file:\/\//);
    expect(await provider.exists('test/hello.txt')).toBe(true);
  });

  it('getSignedUrl 返回带 token 的路径', async () => {
    await provider.put({ key: 'a/b.txt', body: Buffer.from('x'), contentType: 'text/plain' });
    const url = await provider.getSignedUrl({ key: 'a/b.txt', expiresInSec: 60 });
    expect(url).toMatch(/^\/api\/v1\/local-storage\//);
    expect(url).toContain('t=60');
    expect(url).toContain('s=');
  });

  it('同 key + 同 expiresIn 产生稳定 token (HMAC 确定性)', async () => {
    await provider.put({ key: 'k.txt', body: Buffer.from('x') });
    const u1 = await provider.getSignedUrl({ key: 'k.txt', expiresInSec: 60 });
    const u2 = await provider.getSignedUrl({ key: 'k.txt', expiresInSec: 60 });
    expect(u1).toBe(u2);
  });

  it('delete 后 exists 为 false (幂等: 删不存在不抛)', async () => {
    await provider.put({ key: 'd.txt', body: Buffer.from('x') });
    expect(await provider.exists('d.txt')).toBe(true);
    await provider.delete('d.txt');
    expect(await provider.exists('d.txt')).toBe(false);
    await expect(provider.delete('d.txt')).resolves.toBeUndefined();
  });

  it('stream body 也能 put', async () => {
    const { Readable } = await import('node:stream');
    const stream = Readable.from([Buffer.from('chunk1'), Buffer.from('chunk2')]);
    await provider.put({ key: 's.bin', body: stream });
    const content = await fs.readFile(path.join(tmpDir, 's.bin'), 'utf8');
    expect(content).toBe('chunk1chunk2');
  });
});
