// InvitationService — 邀请系统业务逻辑
// ============================================================================
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 创建邀请 */
  async createInvitation(
    tenantId: string,
    inviterId: string,
    dto: { email: string; roleIds?: string[]; authorizerIds?: string[] },
  ) {
    // 检查是否已被邀请
    const existing = await this.prisma.invitation.findFirst({
      where: { tenantId, email: dto.email, status: 'pending' },
    });
    if (existing) throw new BadRequestException('该邮箱已有待接受的邀请');

    // 检查是否已是租户成员
    const user = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email, deletedAt: null },
    });
    if (user) throw new BadRequestException('该邮箱已是团队成员');

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 86400000); // 7 天有效期

    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId,
        inviterId,
        email: dto.email,
        token,
        roleIds: dto.roleIds || [],
        authorizerIds: dto.authorizerIds || [],
        expiresAt,
      },
    });

    // 记录团队活动
    await this.prisma.teamActivity.create({
      data: {
        tenantId,
        userId: inviterId,
        action: 'user.invited',
        targetType: 'invitation',
        targetId: invitation.id,
        metadata: { email: dto.email } as any,
      },
    });

    this.logger.log(`Invitation created: ${dto.email} by user ${inviterId}`);
    return {
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
    };
  }

  /** 获取租户邀请列表 */
  async getInvitations(tenantId: string) {
    return this.prisma.invitation.findMany({
      where: { tenantId },
      include: {
        inviter: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 取消邀请 */
  async cancelInvitation(tenantId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, tenantId },
    });
    if (!invitation) throw new NotFoundException('邀请不存在');
    if (invitation.status !== 'pending') throw new BadRequestException('该邀请已处理');

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'cancelled' },
    });
    return { cancelled: true };
  }

  /** 接受邀请（公开接口，仅需 token 验证，无 JWT） */
  async acceptInvitation(token: string, dto: { name: string; password: string }) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
    });
    if (!invitation) throw new NotFoundException('邀请链接无效');
    if (invitation.status !== 'pending') throw new BadRequestException('该邀请已过期或已被使用');
    if (new Date() > invitation.expiresAt) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' },
      });
      throw new BadRequestException('邀请已过期');
    }
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException('密码至少 6 位');
    }

    // 创建用户（事务）
    const result = await this.prisma.$transaction(async (tx: any) => {
      const passwordHash = await bcrypt.hash(dto.password, 12);
      const user = await tx.user.create({
        data: {
          tenantId: invitation.tenantId,
          email: invitation.email,
          passwordHash,
          name: dto.name,
          status: 'active',
        },
      });

      // 分配角色
      for (const roleId of invitation.roleIds || []) {
        await tx.userRole.create({ data: { userId: user.id, roleId } });
      }

      // 分配公众号权限
      for (const authorizerId of invitation.authorizerIds || []) {
        await tx.userAuthorizer.create({
          data: {
            tenantId: invitation.tenantId,
            userId: user.id,
            authorizerId,
            authorizerRole: 'editor',
          },
        });
      }

      // 更新邀请状态
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      });

      return user;
    });

    // 记录团队活动
    await this.prisma.teamActivity.create({
      data: {
        tenantId: invitation.tenantId,
        userId: result.id,
        action: 'user.joined',
        targetType: 'invitation',
        targetId: invitation.id,
        metadata: { email: invitation.email } as any,
      },
    });

    this.logger.log(`Invitation accepted: ${invitation.email}`);
    return { userId: result.id, email: result.email, name: result.name };
  }

  /** 清理过期邀请（定时任务调用） */
  async expireStaleInvitations() {
    const { count } = await this.prisma.invitation.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired' },
    });
    if (count > 0) this.logger.log(`Expired ${count} stale invitations`);
    return { expired: count };
  }
}
