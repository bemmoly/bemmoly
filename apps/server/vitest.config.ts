import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.int.test.ts'],
    // Several tests build the whole app with every module, which takes ~6 s on CI runners.
    testTimeout: 15_000,
  },
});
