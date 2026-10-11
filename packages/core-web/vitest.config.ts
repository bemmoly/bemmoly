import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    // DOM tests render whole screens and run property checks; on a loaded CI runner some
    // take 5 to 6 s, so vitest's 5 s default failed different tests on different runs.
    testTimeout: 15_000,
    setupFiles: ['src/test/setup.ts'],
  },
});
