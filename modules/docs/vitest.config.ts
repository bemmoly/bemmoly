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
        /** The web chunk's hooks and screens run in a DOM against MSW, as Work's do. */
        test: {
          name: 'web',
          include: ['web/**/*.test.{ts,tsx}'],
          environment: 'happy-dom',
        },
      },
    ],
  },
});
