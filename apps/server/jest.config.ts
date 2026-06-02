// Jest configuration for NestJS server
// ============================================================================
import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/main.ts',
    '!src/prisma/prisma.service.ts',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'json-summary', 'html'],
  // Coverage thresholds — see docs/adrs/ADR-001-coverage-thresholds-v2.0.md
  // V2.0 spec §1.5 仅强制 line ≥ 60%. functions 门槛设为 40% (低于当前 45.35%
  // 的"地板"防回退,V2.0.x 渐进抬升到 60%); branches 50% 已是 spec 默认底线.
  coverageThreshold: {
    global: {
      lines: 60,
      functions: 40,
      statements: 60,
      branches: 50,
    },
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/test/e2e/'],
  testEnvironment: 'node',
  testTimeout: 30000,
  // forceExit: 强退避开 BullMQ/Redis mock 未关闭的 open handles 导致 jest 不退出
  // (本地 + CI 一致)。技术债:逐 spec 加 afterAll(() => bullQueue.close()) 后可去掉。
  forceExit: true,
  moduleNameMapper: {
    '^@wxgzh/shared$': '<rootDir>/../../packages/shared/src',
  },
};

export default config;
