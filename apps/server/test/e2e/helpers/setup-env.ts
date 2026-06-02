// test/e2e/helpers/setup-env.ts
// E2E 全局环境: 注入测试用 env vars (DB/Redis/JWT/Encryption)
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] =
  process.env['DATABASE_URL'] || 'postgresql://wxgzh:wxgzh123@localhost:5432/wxgzh_test';
process.env['REDIS_URL'] = process.env['REDIS_URL'] || 'redis://localhost:6379/1';
process.env['JWT_SECRET'] = process.env['JWT_SECRET'] || 'test-secret-do-not-use-in-production';
process.env['ENCRYPTION_KEY'] = process.env['ENCRYPTION_KEY'] || '0123456789abcdef0123456789abcdef';
process.env['STORAGE_DRIVER'] = 'local';
process.env['LOCAL_STORAGE_DIR'] = process.env['LOCAL_STORAGE_DIR'] || '/tmp/wxgzh-e2e';
