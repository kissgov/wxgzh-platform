// NestJS 应用入口
// ============================================================================
// 必须在最顶部:把 zod 原型扩展出 .openapi() 方法,让 @ZodResponse metadata
// 可序列化到 Swagger 文档。详细见 ./common/swagger/zod-to-swagger.ts。
import './common/swagger/zod-to-swagger';
// OTel SDK 必须在 import 业务代码前初始化 (S3)
import { startOtel } from './common/observability/otel';
startOtel();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { TraceIdInterceptor } from './common/observability/trace.interceptor';
import { MetricsInterceptor } from './common/middleware/metrics.interceptor';
import { metricsRegistry } from './common/observability/metrics';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  // S3 拦截器: trace_id 注入 + Prometheus HTTP metrics
  app.useGlobalInterceptors(new TraceIdInterceptor(), new MetricsInterceptor());
  const logger = new Logger('Bootstrap');

  // 暴露 /metrics 端点 (S3 Prometheus scrape) — 必须在 setGlobalPrefix 之前
  // (避免被加上 /api/v1 前缀,Prometheus 习惯走根路径)
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.get('/metrics', async (_req: any, res: any) => {
    res.set('Content-Type', metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
  });
  httpAdapter.get('/healthz', (_req: any, res: any) => res.status(200).json({ ok: true }));

  // 安全头（X-Frame-Options, X-XSS-Protection, CSP 等）
  app.use(helmet());

  // 全局前缀
  app.setGlobalPrefix('api/v1');

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // 自动剥离未定义的属性
      forbidNonWhitelisted: true, // 拒绝未定义的属性（返回 400）
      transform: true,            // 自动转换类型（string → number）
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS — 开发环境宽松，生产环境白名单
  const corsOrigins = process.env['CORS_ORIGINS']?.split(',').map((s) => s.trim()) || [];
  app.enableCors({
    origin: process.env['NODE_ENV'] === 'development' ? '*' : corsOrigins.length ? corsOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Trace-Id'],
  });

  // Swagger 文档
  const config = new DocumentBuilder()
    .setTitle('WXGZH Platform API')
    .setDescription('微信公众号第三方运营管理平台 API 文档')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env['APP_PORT'] || 3000;
  await app.listen(port);
  logger.log(`🚀 Server running on http://localhost:${port}`);
  logger.log(`📄 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
