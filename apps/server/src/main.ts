// NestJS 应用入口
// ============================================================================
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

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
