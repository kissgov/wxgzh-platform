// AuthController — 登录 / 注册 / Token 刷新
// ============================================================================
import { Controller, Post, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RateLimit } from '../../common/ratelimit/rate-limit.guard';
import { AuthService } from './auth.service';

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
  async login(@Body() body: { email: string; password: string }) {
    const data = await this.authService.login(body.email, body.password);
    return { code: 0, message: '登录成功', data };
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: '用户注册（自动创建租户）' })
  async register(
    @Body() body: { name: string; email: string; password: string; company: string },
  ) {
    const data = await this.authService.register(body);
    return { code: 0, message: '注册成功', data };
  }

  @Put('profile')
  @ApiOperation({ summary: '更新个人信息' })
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() body: { name?: string; oldPassword?: string; newPassword?: string },
  ) {
    const data = await this.authService.updateProfile(userId, body);
    return { code: 0, message: '更新成功', data };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: '刷新 Token（带轮转）' })
  async refresh(@Body() body: { refresh_token: string }) {
    const data = await this.authService.refreshToken(body.refresh_token);
    return { code: 0, message: 'Token 已刷新', data };
  }
}
