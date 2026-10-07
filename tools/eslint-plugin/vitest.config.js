import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.js'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['cobertura'],
      include: ['src/**/*.js'],
    },
  },
});
