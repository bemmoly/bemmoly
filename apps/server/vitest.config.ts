import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.int.test.ts'],
    // Several tests build the whole app with every module. The first build in a file also pays
    // the cold import of every module, which has passed 15 s on a busy CI runner.
    testTimeout: 30_000,
  },
});
