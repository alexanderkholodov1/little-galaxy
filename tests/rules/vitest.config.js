import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.js'],
    environment: 'node',
    silent: false,
    pool: 'threads',
    fileParallelism: false,
    testTimeout: 45000,
    hookTimeout: 30000,
  },
});
