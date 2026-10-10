import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __MOCK_API__: 'false', __DEMO__: 'false', __APP_VERSION__: '"0.0.0-test"' },
  test: {
    include: ['src/**/*.test.{ts,tsx}', '*.test.ts'],
    environment: 'happy-dom',
    setupFiles: ['src/test/setup.ts'],
  },
});
