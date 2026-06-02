// CryptoService 单元测试
// ============================================================================
import * as crypto from 'node:crypto';
import { CryptoService } from '../../../../src/common/security/crypto.service';

describe('CryptoService — AES-256-GCM', () => {
  let svc: CryptoService;

  beforeEach(() => {
    process.env['ENCRYPTION_KEY'] = crypto.randomBytes(32).toString('hex');
    svc = new CryptoService();
  });

  it('round-trips ASCII plaintext', () => {
    const plain = 'hello world';
    const enc = svc.encryptGCM(plain);
    expect(enc).not.toBe(plain);
    const dec = svc.decryptGCM(enc);
    expect(dec).toBe(plain);
  });

  it('round-trips UTF-8 (中文/emoji)', () => {
    const plain = '微信公众号 🔐 加密';
    const enc = svc.encryptGCM(plain);
    const dec = svc.decryptGCM(enc);
    expect(dec).toBe(plain);
  });

  it('throws when tag is tampered (密文完整性保护)', () => {
    const plain = 'secret';
    const enc = svc.encryptGCM(plain);
    // 篡改密文最后 1 字节
    const buf = Buffer.from(enc, 'base64');
    const lastIdx = buf.length - 1;
    buf[lastIdx] = (buf[lastIdx] ?? 0) ^ 0xff;
    const tampered = buf.toString('base64');
    expect(() => svc.decryptGCM(tampered)).toThrow();
  });

  it('throws when IV is tampered', () => {
    const enc = svc.encryptGCM('secret');
    const buf = Buffer.from(enc, 'base64');
    buf[0] = (buf[0] ?? 0) ^ 0xff; // 改 iv
    expect(() => svc.decryptGCM(buf.toString('base64'))).toThrow();
  });

  it('AAD mismatch throws', () => {
    const enc = svc.encryptGCM('secret', 'tenant-1');
    expect(() => svc.decryptGCM(enc, 'tenant-2')).toThrow();
    // 正确 AAD 可解
    expect(svc.decryptGCM(enc, 'tenant-1')).toBe('secret');
  });

  it('different IVs for same plaintext (semantic security)', () => {
    const enc1 = svc.encryptGCM('same');
    const enc2 = svc.encryptGCM('same');
    expect(enc1).not.toBe(enc2); // 随机 IV 保证密文不同
  });

  it('rejects payload too short', () => {
    const short = Buffer.from([1, 2, 3]).toString('base64');
    expect(() => svc.decryptGCM(short)).toThrow(/too short/);
  });
});

describe('CryptoService — AES-256-CBC (legacy)', () => {
  it('decrypts V1 CBC payload (向后兼容)', () => {
    process.env['ENCRYPTION_KEY'] = crypto.randomBytes(32).toString('hex');
    const svc = new CryptoService();
    const key = svc['key'] as Buffer;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const enc = Buffer.concat([cipher.update('legacy data', 'utf-8'), cipher.final()]);
    const payload = Buffer.concat([iv, enc]).toString('base64');
    expect(svc.decryptCBC(payload)).toBe('legacy data');
  });
});

describe('CryptoService.generateKey', () => {
  it('returns 64 hex chars (32 bytes)', () => {
    const k = CryptoService.generateKey();
    expect(k).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns different keys on each call', () => {
    const k1 = CryptoService.generateKey();
    const k2 = CryptoService.generateKey();
    expect(k1).not.toBe(k2);
  });
});
