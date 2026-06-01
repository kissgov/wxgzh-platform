// Campaign DTO
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CampaignListQueryDto {
  @ApiPropertyOptional({ default: 1 }) @Type(() => Number) @IsInt() @Min(1) @IsOptional() page?: number = 1;
  @ApiPropertyOptional({ default: 20 }) @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() page_size?: number = 20;
  @ApiPropertyOptional({ enum: ['h5_page', 'qrcode', 'referral'] }) @IsString() @IsOptional() type?: string;
  @ApiPropertyOptional({ enum: ['draft', 'active', 'paused', 'ended'] }) @IsString() @IsOptional() status?: string;
}

export class CreateCampaignDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ enum: ['h5_page', 'qrcode', 'referral'] }) @IsString() @IsIn(['h5_page', 'qrcode', 'referral']) type!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsOptional() config?: any;
  @ApiPropertyOptional() @IsString() @IsOptional() startAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() endAt?: string;
}

export class CreateQrCodeDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsString() sceneStr!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() campaignId?: string;
}
