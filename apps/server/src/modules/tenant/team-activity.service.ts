// TeamActivityService — 团队活动日志查询
// ============================================================================
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TeamActivityService {
  constructor(private readonly prisma: PrismaService) {}

  /** 获取团队活动日志（分页） */
  async getActivities(
    tenantId: string,
    query: { page?: number; page_size?: number; action?: string; userId?: string },
  ) {
    const page = query.page || 1;
    const page_size = query.page_size || 20;
    const where: Record<string, unknown> = { tenantId };
    if (query.action) where['action'] = { startsWith: query.action };
    if (query.userId) where['userId'] = query.userId;

    const [list, total] = await Promise.all([
      this.prisma.teamActivity.findMany({
        where: where as any,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * page_size,
        take: page_size,
      }),
      this.prisma.teamActivity.count({ where: where as any }),
    ]);

    return { list, total, page, page_size };
  }
}
