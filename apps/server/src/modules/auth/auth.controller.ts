// AuthController — 登录 / 注册 / Token 刷新
// ============================================================================
import { Controller, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { ZodResponse } from '../../common/decorators/zod-response.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RateLimit } from '../../common/ratelimit/rate-limit.guard';
import { AuthService } from './auth.service';
import {
  LoginInputSchema,
  LoginOutputSchema,
  RegisterInputSchema,
  RegisterOutputSchema,
  UpdateProfileInputSchema,
  UpdateProfileOutputSchema,
  RefreshInputSchema,
  RefreshOutputSchema,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
  type RefreshInput,
} from '../../common/contracts/auth.contract';

@ApiTags('认证')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @RateLimit(5, 60_000, 'ip') // S4: 防登录爆破, 5 次/分钟/IP
  @ApiOperation({ summary: '用户登录' })
  @ZodResponse(LoginOutputSchema)
  async login(@ZodBody(LoginInputSchema) input: LoginInput) {
    const data = await this.authService.login(input.email, input.password);
    return { code: 0, message: '登录成功', data };
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: '用户注册（自动创建租户）' })
  @ZodResponse(RegisterOutputSchema)
  async register(@ZodBody(RegisterInputSchema) input: RegisterInput) {
    const data = await this.authService.register(input);
    return { code: 0, message: '注册成功', data };
  }

  @Put('profile')
  @ApiOperation({ summary: '更新个人信息' })
  @ZodResponse(UpdateProfileOutputSchema)
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @ZodBody(UpdateProfileInputSchema) input: UpdateProfileInput,
  ) {
    const data = await this.authService.updateProfile(userId, input);
    return { code: 0, message: '更新成功', data };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: '刷新 Token（带轮转）' })
  @ZodResponse(RefreshOutputSchema)
  async refresh(@ZodBody(RefreshInputSchema) input: RefreshInput) {
    const data = await this.authService.refreshToken(input.refresh_token);
    return { code: 0, message: 'Token 已刷新', data };
  }
}
