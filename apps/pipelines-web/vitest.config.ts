import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __APP_VERSION__: '"0.0.0-test"' },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    testTimeout: 15_000,
    setupFiles: ['src/test/setup.ts'],
  },
});
