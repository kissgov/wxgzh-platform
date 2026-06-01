// BullMQ Worker 独立进程入口
// PM2: pm2 start ecosystem.config.js --only wxgzh-worker
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('Worker process started');
}

bootstrap();
