import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['cobertura'],
      include: ['**/*.ts'],
      exclude: ['**/node_modules/**'],
    },
  },
});
