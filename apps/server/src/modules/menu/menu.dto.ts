// Menu 模块 DTO
// ============================================================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';

export class SaveMenuDto {
  @ApiProperty({ description: '菜单 JSON', type: 'object' })
  @IsObject()
  menuJson!: Record<string, unknown>;
}

export class CreateMenuTemplateDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  description?: string;

  @ApiProperty({ type: 'object' })
  @IsObject()
  menuJson!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  category?: string;
}
