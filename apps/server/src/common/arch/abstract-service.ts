// apps/server/src/common/arch/abstract-service.ts
// 业务 service 基类: 统一 safe() 包装 + 日志
// V2.0 S6 引入, 不强制 V1 业务 service 改造, 留 V2.1
import { Inject, LoggerService } from '@nestjs/common';

export abstract class AbstractService {
  // LoggerService 兼容 nestjs 内置 Logger + winston (WINSTON_MODULE_PROVIDER)
  @Inject() protected readonly logger!: LoggerService;
  protected get log() {
    return this.logger;
  }

  // 业务方法必须用此方法包装: 计时 + 成功/失败日志
  protected async safe<T>(name: string, fn: () => Promise<T>, ctx?: Record<string, unknown>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.log.debug?.({ name, durationMs: Date.now() - start, ...ctx }, `${name} ok`);
      return result;
    } catch (err) {
      const e = err as Error;
      this.log.error?.({ name, err: e.message, stack: e.stack, ...ctx }, `${name} failed`);
      throw err;
    }
  }
}
