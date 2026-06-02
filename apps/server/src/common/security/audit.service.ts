// AuditService — 写 audit_logs 表
// ============================================================================
// 适配 V1 schema: AuditLog { tenantId, userId, action, resource, resourceId,
//   detail, ip, userAgent, createdAt }
// ============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogInput {
  /** 操作动作 (e.g. 'authorizer.revoked', 'broadcast.sent') */
  action: string;
  /** 资源类型 (e.g. 'authorizer', 'menu') */
  resource: string;
  /** 资源 ID */
  resourceId?: string;
  /** 操作人 */
  userId: string;
  /** 租户 */
  tenantId: string;
  /** IP */
  ip?: string;
  /** User-Agent */
  userAgent?: string;
  /** 附加详情 */
  detail?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId,
          ip: input.ip,
          userAgent: input.userAgent,
          detail: input.detail as any,
        },
      });
    } catch (err: any) {
      // 审计失败不应阻塞业务, 但必须记日志
      this.logger.error(`审计日志写入失败: ${err.message}`, err.stack);
    }
  }
}
