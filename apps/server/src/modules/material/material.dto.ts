// Material 模块 DTO
// ============================================================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsIn, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class MaterialListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number) @IsInt() @Min(1) @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional()
  page_size?: number = 20;

  @ApiPropertyOptional({ enum: ['image', 'voice', 'video', 'thumb', 'news'] })
  @IsString() @IsIn(['image', 'voice', 'video', 'thumb', 'news']) @IsOptional()
  type?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  keyword?: string;

  @ApiPropertyOptional()
  @IsArray() @IsString({ each: true }) @IsOptional()
  tags?: string[];
}

export class UpdateMaterialDto {
  @ApiPropertyOptional()
  @IsString() @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsArray() @IsString({ each: true }) @IsOptional()
  tags?: string[];
}
