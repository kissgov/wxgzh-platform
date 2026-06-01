// Message 模块 DTO — 消息管理
// ============================================================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsInt, Min, Max, IsIn, IsArray, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MessageLogQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number) @IsInt() @Min(1) @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional()
  page_size?: number = 50;

  @ApiPropertyOptional({ enum: ['inbound', 'outbound'] })
  @IsString() @IsIn(['inbound', 'outbound']) @IsOptional()
  direction?: string;

  @ApiPropertyOptional({ enum: ['text', 'image', 'voice', 'video', 'event'] })
  @IsString() @IsOptional()
  msgType?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  keyword?: string;
}

export class CreateAutoReplyDto {
  @ApiProperty({ enum: ['follow', 'keyword', 'default'] })
  @IsString() @IsIn(['follow', 'keyword', 'default'])
  ruleType!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ enum: ['enabled', 'disabled'], default: 'enabled' })
  @IsString() @IsIn(['enabled', 'disabled']) @IsOptional()
  status?: string = 'enabled';

  @ApiPropertyOptional({ type: 'array' })
  @IsArray() @IsOptional()
  keywordReplies?: Array<{ matchType: string; keyword: string }>;

  @ApiProperty({ type: 'array' })
  @IsArray() @ArrayMinSize(1)
  replyContents!: Array<{ contentType: string; content: string; sortOrder?: number }>;
}

export class CreateBroadcastDto {
  @ApiProperty({ enum: ['text', 'image', 'mpnews', 'voice', 'video', 'wxcard'] })
  @IsString() @IsIn(['text', 'image', 'mpnews', 'voice', 'video', 'wxcard'])
  msgType!: string;

  @ApiProperty({ type: 'object' })
  content!: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['all', 'tag', 'region', 'gender'], default: 'all' })
  @IsString() @IsIn(['all', 'tag', 'region', 'gender']) @IsOptional()
  targetType?: string = 'all';

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  targetConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '定时发送时间（ISO 8601）' })
  @IsString() @IsOptional()
  scheduledAt?: string;
}
