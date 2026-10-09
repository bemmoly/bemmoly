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
    ],
  },
});
