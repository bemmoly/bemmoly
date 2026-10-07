import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __MOCK_API__: 'false' },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    setupFiles: ['src/test/setup.ts'],
  },
});
