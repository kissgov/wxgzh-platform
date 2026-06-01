// Platform 模块 DTO — 第三方平台授权
// ============================================================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAuthUrlDto {
  @ApiPropertyOptional({ description: '重新授权时传入的 authorizerId' })
  @IsString()
  @IsOptional()
  authorizerId?: string;
}

export class AuthorizerListQueryDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @Type(() => Number)
  @IsInt() @Min(1) @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页条数', default: 20 })
  @Type(() => Number)
  @IsInt() @Min(1) @Max(100) @IsOptional()
  page_size?: number = 20;

  @ApiPropertyOptional({ description: '关键词搜索（公众号名称/appId）' })
  @IsString() @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({ description: '授权状态过滤', enum: ['authorized', 'expired', 'revoked'] })
  @IsString() @IsIn(['authorized', 'expired', 'revoked']) @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: '排序字段', default: 'authorizedAt' })
  @IsString() @IsOptional()
  sort?: string = 'authorizedAt';

  @ApiPropertyOptional({ description: '排序方向', enum: ['asc', 'desc'], default: 'desc' })
  @IsString() @IsIn(['asc', 'desc']) @IsOptional()
  order?: 'asc' | 'desc' = 'desc';
}

/** 更新第三方平台配置 */
export class UpdateComponentAppDto {
  @ApiProperty({ description: '第三方平台 AppID (wx开头)' })
  @IsString()
  appId!: string;

  @ApiProperty({ description: '第三方平台 AppSecret' })
  @IsString()
  appSecret!: string;

  @ApiProperty({ description: '消息校验 Token (3-32字符)' })
  @IsString()
  token!: string;

  @ApiProperty({ description: '消息加解密 Key (43字符)' })
  @IsString()
  encodingAesKey!: string;
}
