// Material Service — 素材管理
// ============================================================================
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { MaterialListQueryDto, UpdateMaterialDto } from './material.dto';

@Injectable()
export class MaterialService {
  private readonly logger = new Logger(MaterialService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMaterials(tenantId: string, query: MaterialListQueryDto) {
    const { page = 1, page_size = 20, type, category, keyword, tags } = query;
    const where: Record<string, unknown> = { tenantId, deletedAt: null };

    if (type) where['type'] = type;
    if (category) where['category'] = category;
    if (keyword) {
      where['OR'] = [
        { name: { contains: keyword } },
        { format: { contains: keyword } },
      ];
    }
    if (tags?.length) where['tags'] = { hasSome: tags };

    const [list, total] = await Promise.all([
      this.prisma.material.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * page_size,
        take: page_size,
      }),
      this.prisma.material.count({ where: where as any }),
    ]);
    return { list, total, page, page_size };
  }

  /** 创建素材记录（文件上传由 Controller 处理 + MinIO 存储后调用此方法） */
  async createMaterial(tenantId: string, data: {
    authorizerId?: string;
    type: string;
    name: string;
    url: string;
    thumbUrl?: string;
    fileSize?: number;
    width?: number;
    height?: number;
    duration?: number;
    format?: string;
    category?: string;
    tags?: string[];
  }) {
    return this.prisma.material.create({
      data: {
        tenantId,
        authorizerId: data.authorizerId,
        type: data.type,
        name: data.name,
        url: data.url,
        thumbUrl: data.thumbUrl,
        fileSize: data.fileSize,
        width: data.width,
        height: data.height,
        duration: data.duration,
        format: data.format,
        category: data.category || 'uncategorized',
        tags: data.tags || [],
      },
    });
  }

  async updateMaterial(materialId: string, tenantId: string, dto: UpdateMaterialDto) {
    const material = await this.prisma.material.findFirst({ where: { id: materialId, tenantId } });
    if (!material) throw new NotFoundException('素材不存在');
    return this.prisma.material.update({ where: { id: materialId }, data: dto });
  }

  async deleteMaterial(materialId: string, tenantId: string) {
    const material = await this.prisma.material.findFirst({ where: { id: materialId, tenantId } });
    if (!material) throw new NotFoundException('素材不存在');

    await this.prisma.material.update({
      where: { id: materialId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  /** 获取素材详情 */
  async getMaterialDetail(materialId: string, tenantId: string) {
    const material = await this.prisma.material.findFirst({
      where: { id: materialId, tenantId },
      include: { usageLogs: { take: 10, orderBy: { createdAt: 'desc' } } },
    });
    if (!material || material.deletedAt) throw new NotFoundException('素材不存在');
    return material;
  }

  /** 记录素材使用 */
  async recordUsage(materialId: string, usedIn: string, usedById?: string) {
    await this.prisma.materialUsageLog.create({
      data: { materialId, usedIn, usedById },
    });
    await this.prisma.material.update({
      where: { id: materialId },
      data: { usageCount: { increment: 1 } },
    });
  }

  /** 获取素材分类列表 */
  async getCategories(tenantId: string) {
    const result = await this.prisma.material.groupBy({
      by: ['category'],
      where: { tenantId, deletedAt: null },
      _count: true,
    });
    return result.map((r: any) => ({ category: r.category, count: r._count }));
  }
}
