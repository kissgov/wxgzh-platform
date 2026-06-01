// 微信消息加解密服务
// AES-256-CBC + PKCS7 + Base64 → 微信标准加解密
// 参考: https://developers.weixin.qq.com/doc/oplatform/Third-party_Platforms/2.0/api/Before_Develop/Technical_Plan.html
// ============================================================================
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class WechatCryptoService {
  private readonly logger = new Logger(WechatCryptoService.name);

  /**
   * 验证微信服务器签名
   * 签名算法: SHA1(sort(token, timestamp, nonce, encrypt_msg))
   */
  verifySignature(
    token: string,
    timestamp: string,
    nonce: string,
    encryptMsg: string,
    signature: string,
  ): boolean {
    const sorted = [token, timestamp, nonce, encryptMsg].sort();
    const hash = crypto.createHash('sha1').update(sorted.join('')).digest('hex');
    return hash === signature;
  }

  /**
   * 解密微信推送的加密消息
   * @param encodingAesKey Base64 编码的 AES Key（43 字符）
   * @param encryptedMsg 加密消息体
   * @returns 解密后的明文 XML
   */
  decrypt(encodingAesKey: string, encryptedMsg: string): string {
    // 1. Base64 解码 AES Key（43 字符 → 32 字节）
    const aesKey = Buffer.from(encodingAesKey + '=', 'base64'); // 微信的 EncodingAESKey 需补 '='

    // 2. Base64 解码密文
    const encrypted = Buffer.from(encryptedMsg, 'base64');

    // 3. AES-256-CBC 解密
    const iv = aesKey.subarray(0, 16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    decipher.setAutoPadding(false); // 手动处理 PKCS7

    let decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    // 4. PKCS7 去填充
    const padLength = decrypted[decrypted.length - 1]!;
    decrypted = decrypted.subarray(0, decrypted.length - padLength);

    const decryptedStr = decrypted.toString('utf8');

    // 5. 提取明文（去除 16 字节随机数 + 4 字节长度 + appId）
    const contentLen = decrypted.readUInt32BE(16);
    const content = decryptedStr.substring(20, 20 + contentLen);

    return content;
  }

  /**
   * 加密回复消息
   * @returns 加密后的 XML 字符串
   */
  encrypt(encodingAesKey: string, appId: string, plainText: string): string {
    // 1. Base64 解码 AES Key
    const aesKey = Buffer.from(encodingAesKey + '=', 'base64');

    // 2. 生成 16 字节随机数
    const randomBytes = crypto.randomBytes(16);

    // 3. 构建明文: random(16) + len(4) + text + appId
    const textBuffer = Buffer.from(plainText, 'utf8');
    const lenBuffer = Buffer.alloc(4);
    lenBuffer.writeUInt32BE(textBuffer.length, 0);
    const appIdBuffer = Buffer.from(appId, 'utf8');
    const plainBuffer = Buffer.concat([randomBytes, lenBuffer, textBuffer, appIdBuffer]);

    // 4. PKCS7 填充
    const blockSize = 32;
    const padLength = blockSize - (plainBuffer.length % blockSize);
    const padBuffer = Buffer.alloc(padLength, padLength);
    const paddedBuffer = Buffer.concat([plainBuffer, padBuffer]);

    // 5. AES-256-CBC 加密
    const iv = aesKey.subarray(0, 16);
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    cipher.setAutoPadding(false);
    const encrypted = Buffer.concat([cipher.update(paddedBuffer), cipher.final()]);

    return encrypted.toString('base64');
  }
}
