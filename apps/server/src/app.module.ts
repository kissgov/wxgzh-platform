// 根模块 — 统一管理所有业务模块和基础设施
// ============================================================================
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';

import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { buildLoggerOptions } from './common/observability/logger';

// 基础设施
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
// TraceIdInterceptor 由 main.ts 通过 useGlobalInterceptors 注册 (S3 升级版,包含 OTel + ALS)
import { TenantThrottlerGuard } from './common/guards/tenant-throttler.guard';
import { SubscriptionLimitGuard } from './common/guards/subscription-limit.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionGuard } from './common/security/permission.guard';
import { AuditService } from './common/security/audit.service';
import { AuditInterceptor } from './common/security/audit.interceptor';
import { RateLimitModule } from './common/ratelimit/rate-limit.module';

// 外部集成
import { WechatModule } from './integrations/wechat/wechat.module';

// 对象存储
import { OssModule } from './modules/oss/oss.module';

// 业务模块
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { PlatformModule } from './modules/platform/platform.module';
import { AccountModule } from './modules/account/account.module';
import { FollowerModule } from './modules/follower/follower.module';
import { MessageModule } from './modules/message/message.module';
import { MaterialModule } from './modules/material/material.module';
import { MenuModule } from './modules/menu/menu.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ContentModule } from './modules/content/content.module';
import { CampaignModule } from './modules/campaign/campaign.module';
import { PaymentModule } from './modules/payment/payment.module';
import { LlmModule } from './modules/llm/llm.module';
import { AgentModule } from './modules/agent/agent.module';

@Module({
  imports: [
    // 结构化日志 (pino) — 必须在最前,后续模块可注入 PinoLogger
    LoggerModule.forRoot(buildLoggerOptions()),
    // 配置（Zod 校验，启动门禁）
    ConfigModule,
    // 数据库
    PrismaModule,
    // 对象存储
    OssModule,
    // Redis + 任务队列
    BullModule.forRoot({
      connection: { url: process.env['REDIS_URL'] || 'redis://localhost:6379' },
    }),
    // 限流（按租户+IP, S4 加 sliding-window 精确控制）
    ThrottlerModule.forRoot([{ ttl: 1000, limit: 100 }]),
    RateLimitModule, // S4: 装饰器驱动的 sliding window, 已在 auth.login 应用
    // 事件总线（模块间解耦）
    EventEmitterModule.forRoot({ wildcard: true, maxListeners: 20 }),
    // 定时任务
    ScheduleModule.forRoot(),
    // 外部集成
    WechatModule,
    // 业务模块
    AuthModule,
    TenantModule,
    PlatformModule,
    AccountModule,
    FollowerModule,
    MessageModule,
    MaterialModule,
    MenuModule,
    AnalyticsModule,
    ContentModule,
    CampaignModule,
    PaymentModule,
    LlmModule,
    AgentModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },            // ① 认证（填充 request.user）
    { provide: APP_GUARD, useClass: SubscriptionLimitGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },          // ② 授权（S4 升级版, 集成 PERMISSIONS 常量 + AND 语义）
    { provide: APP_GUARD, useClass: TenantThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    AuditService,                                                // S4: 审计日志服务
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },   // S4: 审计拦截器 (按 @AuditLog 标记)
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
