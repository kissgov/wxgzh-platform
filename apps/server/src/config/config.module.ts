// 配置模块 — 环境变量 Zod 校验，启动时强制门禁
// ============================================================================
import { Global, Module, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { z } from 'zod';

/** 环境变量校验 Schema */
const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL').optional().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.coerce.number().int().positive().optional().default(7200),
  ENCRYPTION_KEY: z.string().length(44, 'ENCRYPTION_KEY must be 32 bytes base64 (44 chars)'),
  OSS_ENDPOINT: z.string().optional().default('localhost'),
  OSS_PORT: z.coerce.number().int().optional().default(9000),
  OSS_ACCESS_KEY: z.string().optional().default('minioadmin'),
  OSS_SECRET_KEY: z.string().optional().default('minioadmin'),
  OSS_BUCKET: z.string().optional().default('wxgzh-materials'),
  OSS_USE_SSL: z.coerce.boolean().optional().default(false),
  APP_PORT: z.coerce.number().int().optional().default(3000),
  APP_HOST: z.string().optional().default('0.0.0.0'),
  CORS_ORIGINS: z.string().optional().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
});

export type AppConfig = z.infer<typeof envSchema>;

/** 全局可注入的配置服务 */
@Injectable()
export class ConfigService {
  private readonly config: AppConfig;
  private readonly logger = new Logger(ConfigService.name);

  constructor() {
    const raw = this.loadEnv();
    const result = envSchema.safeParse(raw);

    if (!result.success) {
      const errors = result.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(
        `Configuration validation FAILED. Application cannot start.\n${errors}\n` +
        'Check your .env file against .env.example for required variables.',
      );
    }

    this.config = result.data;
    this.logger.log('Configuration validated successfully');
    this.logger.log(`Environment: ${this.config.NODE_ENV}`);
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  /** 获取完整配置（用于传递给第三方库） */
  getAll(): Readonly<AppConfig> {
    return this.config;
  }

  private loadEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, val] of Object.entries(process.env)) {
      if (val !== undefined) env[key] = val;
    }
    return env;
  }
}

@Global()
@Module({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}

/** 兼容性：确保模块自身也能作为 NestJS lifecycle hook */
@Global()
@Module({
  imports: [ConfigModule],
})
export class ConfigValidationModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(ConfigValidationModule.name);

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap() {
    const cfg = this.config.getAll();
    this.logger.log(`App starting on ${cfg.APP_HOST}:${cfg.APP_PORT}`);
    this.logger.log(`CORS origins: ${cfg.CORS_ORIGINS}`);
  }
}
