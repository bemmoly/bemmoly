import js from '@eslint/js';
import bemmoly from '@bemmoly/eslint-plugin';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const root = import.meta.dirname;

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/dist-demo/**',
      '**/storybook-static/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/.turbo/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { bemmoly },
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: false, skipComments: false }],
      'bemmoly/boundaries': ['error', { root }],
      'no-console': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read configuration from the parsed env in config/env.ts.',
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: [
      '**/config/env.ts',
      '**/*.test.{ts,js}',
      '**/*.config.{ts,js}',
      'packages/core/src/testing/**',
      'scripts/**',
      'tools/**',
    ],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
  prettier,
);
