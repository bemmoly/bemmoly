import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The container test needs a built image; `pnpm test:container` runs it on its own.
    exclude: process.argv.some((arg) => arg.endsWith('container.test.ts'))
      ? []
      : ['tests/container.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 90_000,
  },
});
