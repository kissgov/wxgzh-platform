// Content DTO — 内容创作
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsIn, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class ArticleListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number) @IsInt() @Min(1) @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional()
  page_size?: number = 20;

  @ApiPropertyOptional({ enum: ['draft', 'pending_review', 'approved', 'published', 'failed'] })
  @IsString() @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  keyword?: string;
}

export class CreateArticleDto {
  @ApiProperty({ description: '标题' })
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  author?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  digest?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  content?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  coverUrl?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsArray() @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  scheduledAt?: string;
}

export class UpdateArticleDto {
  @ApiPropertyOptional()
  @IsString() @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  author?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  digest?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  content?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  coverUrl?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsArray() @IsOptional()
  tags?: string[];
}

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  name!: string;
}

export class CreateTemplateDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  content?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  coverUrl?: string;
}

export class AiGenerateDto {
  @ApiProperty({ description: '提示词/主题' })
  @IsString()
  prompt!: string;

  @ApiPropertyOptional({ enum: ['article', 'outline', 'rewrite', 'expand', 'summarize'] })
  @IsString() @IsIn(['article', 'outline', 'rewrite', 'expand', 'summarize']) @IsOptional()
  type?: string = 'article';

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  context?: string;
}
