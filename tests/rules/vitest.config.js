import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/rules/galaxies.test.js', 'tests/rules/deny-all.test.js'],
    environment: 'node',
    silent: false,
    pool: 'threads',
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 30000,
  },
});
