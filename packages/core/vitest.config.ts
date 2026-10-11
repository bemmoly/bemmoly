import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.int.test.ts'],
    // A few unit tests start real machinery (the tracing SDK, chunked AES over megabytes); on
    // a loaded runner they take 5 to 6 s, so vitest's 5 s default failed them at random.
    testTimeout: 15_000,
  },
});
