// Follower 模块 DTO — 粉丝管理
// ============================================================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsInt, Min, Max, IsIn, IsArray, ArrayMinSize, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FollowerListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number) @IsInt() @Min(1) @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional()
  page_size?: number = 50;

  @ApiPropertyOptional({ description: '标签 ID 过滤' })
  @IsString() @IsOptional()
  tagId?: string;

  @ApiPropertyOptional({ description: '昵称/备注关键词' })
  @IsString() @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({ description: '性别过滤', enum: ['1', '2'] })
  @IsString() @IsIn(['1', '2']) @IsOptional()
  sex?: string;

  @ApiPropertyOptional({ description: '省份过滤' })
  @IsString() @IsOptional()
  province?: string;

  @ApiPropertyOptional({ description: '关注开始日期' })
  @IsString() @IsOptional()
  subscribeSince?: string;

  @ApiPropertyOptional({ description: '关注截止日期' })
  @IsString() @IsOptional()
  subscribeUntil?: string;

  @ApiPropertyOptional({ description: '排序字段', default: 'subscribeAt' })
  @IsString() @IsOptional()
  sort?: string = 'subscribeAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsString() @IsIn(['asc', 'desc']) @IsOptional()
  order?: 'asc' | 'desc' = 'desc';
}

export class CreateTagDto {
  @ApiProperty({ description: '标签名称' })
  @IsString() name!: string;

  @ApiPropertyOptional({ description: '标签颜色' })
  @IsString() @IsOptional()
  color?: string;
}

export class BatchTagDto {
  @ApiProperty({ description: '粉丝 ID 列表', type: [String] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000)
  @IsString({ each: true })
  followerIds!: string[];

  @ApiProperty({ description: '标签 ID 列表', type: [String] })
  @IsArray() @ArrayMinSize(1)
  @IsString({ each: true })
  tagIds!: string[];
}

export class CreateTagRuleDto {
  @ApiProperty({ description: '规则名称' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: '规则描述' })
  @IsString() @IsOptional()
  description?: string;

  @ApiProperty({ description: '规则条件', type: 'array' })
  @IsArray() @ArrayMinSize(1)
  conditions!: Array<{
    field: string;
    operator: string;
    value: unknown;
  }>;

  @ApiProperty({ enum: ['AND', 'OR'], default: 'AND' })
  @IsString() @IsIn(['AND', 'OR'])
  logic: string = 'AND';

  @ApiProperty({ description: '目标标签 ID' })
  @IsString()
  targetTagId!: string;
}

export class UpdateTagRuleDto {
  @ApiPropertyOptional()
  @IsString() @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsArray() @IsOptional()
  conditions?: Array<{ field: string; operator: string; value: unknown }>;

  @ApiPropertyOptional()
  @IsString() @IsIn(['AND', 'OR']) @IsOptional()
  logic?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  targetTagId?: string;

  @ApiPropertyOptional({ enum: ['enabled', 'disabled'] })
  @IsString() @IsIn(['enabled', 'disabled']) @IsOptional()
  status?: string;
}
