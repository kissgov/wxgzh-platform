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
  coverageThreshold: {
    global: {
      lines: 60,
      functions: 60,
      statements: 60,
      branches: 50,
    },
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/test/e2e/'],
  testEnvironment: 'node',
  testTimeout: 30000,
  moduleNameMapper: {
    '^@wxgzh/shared$': '<rootDir>/../../packages/shared/src',
  },
};

export default config;
