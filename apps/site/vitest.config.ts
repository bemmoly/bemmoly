import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The container test needs a built image; `pnpm test:container` runs it.
    exclude: ['tests/container.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
