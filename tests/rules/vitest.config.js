import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.js'],
    environment: 'node',
    pool: 'threads',
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
