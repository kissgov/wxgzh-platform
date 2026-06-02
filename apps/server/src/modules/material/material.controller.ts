// Material Controller — 素材管理 API
// ============================================================================
import {
  Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, RequirePermission } from '../../common/decorators/current-user.decorator';
import { ZodQuery } from '../../common/decorators/zod-query.decorator';
import { ZodResponse } from '../../common/decorators/zod-response.decorator';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { MaterialService } from './material.service';
import {
  ListMaterialsQuerySchema,
  ListMaterialsOutputSchema,
  ListMaterialCategoriesOutputSchema,
  GetMaterialDetailOutputSchema,
  UploadMaterialOutputSchema,
  UpdateMaterialInputSchema,
  UpdateMaterialOutputSchema,
  type ListMaterialsQuery,
  type UpdateMaterialInput,
} from '../../common/contracts/material.contract';

@ApiTags('素材管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('materials')
export class MaterialController {
  constructor(private readonly materialService: MaterialService) {}

  @Get()
  @RequirePermission('material:read')
  @ApiOperation({ summary: '素材列表' })
  @ZodResponse(ListMaterialsOutputSchema)
  async list(
    @TenantId() tenantId: string,
    @ZodQuery(ListMaterialsQuerySchema) q: ListMaterialsQuery,
  ) {
    const data = await this.materialService.getMaterials(tenantId, q);
    return { code: 0, message: '成功', data };
  }

  @Get('categories')
  @RequirePermission('material:read')
  @ApiOperation({ summary: '素材分类列表' })
  @ZodResponse(ListMaterialCategoriesOutputSchema)
  async categories(@TenantId() tenantId: string) {
    const data = await this.materialService.getCategories(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Get(':materialId')
  @RequirePermission('material:read')
  @ApiOperation({ summary: '素材详情' })
  @ZodResponse(GetMaterialDetailOutputSchema)
  async detail(
    @TenantId() tenantId: string,
    @Param('materialId') materialId: string,
  ) {
    const data = await this.materialService.getMaterialDetail(materialId, tenantId);
    return { code: 0, message: '成功', data };
  }

  @Post('upload')
  @RequirePermission('material:upload')
  @ApiOperation({ summary: '上传素材' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ZodResponse(UploadMaterialOutputSchema)
  async upload(
    @TenantId() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
    @Body('type') type: string,
    @Body('category') category?: string,
    @Body('tags') tags?: string,
    @Query('authorizerId') authorizerId?: string,
  ) {
    if (!file) return { code: 10001, message: '请选择文件', data: null };

    const isImage = file.mimetype?.startsWith('image/');
    const isVideo = file.mimetype?.startsWith('video/');
    const maxSize = isImage ? 10 * 1024 * 1024 : isVideo ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return { code: 10001, message: `文件大小超过限制（${maxSize / 1024 / 1024}MB）`, data: null };
    }

    const mockUrl = `/api/v1/materials/file/${Date.now()}_${file.originalname}`;
    const format = file.originalname.split('.').pop()?.toLowerCase();

    const data = await this.materialService.createMaterial(tenantId, {
      authorizerId,
      type: type || (isImage ? 'image' : isVideo ? 'video' : 'thumb'),
      name: name || file.originalname,
      url: mockUrl,
      fileSize: file.size,
      format,
      category,
      tags: tags ? tags.split(',').filter(Boolean) : [],
    });

    return { code: 0, message: '上传成功', data };
  }

  @Put(':materialId')
  @RequirePermission('material:update')
  @ApiOperation({ summary: '编辑素材信息' })
  @ZodResponse(UpdateMaterialOutputSchema)
  async update(
    @TenantId() tenantId: string,
    @Param('materialId') materialId: string,
    @ZodBody(UpdateMaterialInputSchema) input: UpdateMaterialInput,
  ) {
    const data = await this.materialService.updateMaterial(materialId, tenantId, input);
    return { code: 0, message: '已更新', data };
  }

  @Delete(':materialId')
  @RequirePermission('material:delete')
  @ApiOperation({ summary: '删除素材' })
  async delete(
    @TenantId() tenantId: string,
    @Param('materialId') materialId: string,
  ) {
    await this.materialService.deleteMaterial(materialId, tenantId);
    return { code: 0, message: '已删除', data: null };
  }
}
