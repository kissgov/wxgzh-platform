// Account 模块 DTO — 多公众号管理
// ============================================================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsInt, Min, Max, IsIn, IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AccountListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt() @Min(1) @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt() @Min(1) @Max(100) @IsOptional()
  page_size?: number = 20;

  @ApiPropertyOptional({ description: '分组 ID 过滤' })
  @IsString() @IsOptional()
  groupId?: string;

  @ApiPropertyOptional({ description: '关键词搜索' })
  @IsString() @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({ description: '公众号类型过滤', enum: ['0', '1', '2'] })
  @IsString() @IsIn(['0', '1', '2']) @IsOptional()
  appType?: string;
}

export class CreateGroupDto {
  @ApiProperty({ description: '分组名称' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: '父分组 ID' })
  @IsString() @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ description: '排序' })
  @IsInt() @IsOptional()
  sortOrder?: number;
}

export class UpdateGroupDto {
  @ApiPropertyOptional({ description: '分组名称' })
  @IsString() @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '排序' })
  @IsInt() @IsOptional()
  sortOrder?: number;
}

export class AddAccountsToGroupDto {
  @ApiProperty({ description: '公众号 ID 列表', type: [String] })
  @IsArray()
  @IsString({ each: true })
  authorizerIds!: string[];
}
