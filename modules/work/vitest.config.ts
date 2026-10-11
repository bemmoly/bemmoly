import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/*.int.test.ts'],
    projects: [
      {
        test: {
          name: 'server',
          include: ['**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/*.int.test.ts', 'web/**'],
        },
      },
      {
        /** The web chunk's hooks and components run in a DOM against MSW, as the shell's do. */
        test: {
          name: 'web',
          include: ['web/**/*.test.{ts,tsx}'],
          environment: 'happy-dom',
          // DOM tests render whole screens and run property checks; on a loaded CI runner some
          // take 5 to 6 s, so vitest's 5 s default failed different tests on different runs.
          testTimeout: 15_000,
          setupFiles: ['web/src/test/setup.ts'],
        },
      },
    ],
  },
});
