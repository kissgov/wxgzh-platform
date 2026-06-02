// CryptoService — 应用级 AES-256-GCM 加密 (DB 字段 / 缓存值)
// ============================================================================
// wechat.crypto.service.ts 是微信官方协议 (强制 AES-256-CBC), 不可改。
// 本服务用于应用内敏感字段: appSecret 备份、refresh token 缓存、临时凭证等。
//
// 输出格式 (base64): [iv(12B) | tag(16B) | ciphertext]
// ============================================================================
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly key: Buffer;

  constructor() {
    // 32 字节 (256 bit) key, 来源: env ENCRYPTION_KEY (hex 64 字符) 或派生
    const raw = process.env['ENCRYPTION_KEY'] || '';
    if (raw.length === 64) {
      this.key = Buffer.from(raw, 'hex');
    } else if (raw.length > 0) {
      // 短 key: SHA-256 派生
      this.key = crypto.createHash('sha256').update(raw).digest();
    } else {
      // 开发兜底: 固定 dev key (生产必须配置 ENCRYPTION_KEY)
      this.logger.warn('ENCRYPTION_KEY 未配置, 使用 dev key (生产禁止)');
      this.key = crypto.createHash('sha256').update('dev-encryption-key').digest();
    }
  }

  /**
   * AES-256-GCM 加密
   * @param plaintext 明文
   * @param aad 可选 AAD (additional authenticated data), 解密时必须匹配
   * @returns base64(iv|tag|ciphertext)
   */
  encryptGCM(plaintext: string, aad?: string): string {
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGO, this.key, iv);
    if (aad) cipher.setAAD(Buffer.from(aad));
    const enc = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  /**
   * AES-256-GCM 解密
   * @throws 当 tag 校验失败 (密文被篡改) 抛 Error
   */
  decryptGCM(payload: string, aad?: string): string {
    const buf = Buffer.from(payload, 'base64');
    if (buf.length < IV_LEN + TAG_LEN) {
      throw new Error('Invalid GCM payload: too short');
    }
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    if (aad) decipher.setAAD(Buffer.from(aad));
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf-8');
  }

  /**
   * AES-256-CBC 解密 (向后兼容 V1 历史数据)
   * 旧数据格式: base64(iv|ciphertext) with PKCS7 padding
   */
  decryptCBC(payload: string, keyOverride?: Buffer): string {
    const key = keyOverride || this.key;
    const buf = Buffer.from(payload, 'base64');
    if (buf.length < 17) throw new Error('Invalid CBC payload: too short');
    const iv = buf.subarray(0, 16);
    const enc = buf.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(true);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf-8');
  }

  /** 生成 32 字节 (256 bit) 随机 key, hex 编码 (供 seed/rotate 使用) */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
