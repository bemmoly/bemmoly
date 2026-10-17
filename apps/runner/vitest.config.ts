import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Job tests run real shell steps and wait on heartbeats measured in seconds.
    testTimeout: 30_000,
  },
});
