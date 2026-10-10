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
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react',
              message:
                'Draw icons with Icon from @bemmoly/ui/icons; add a new one there under a design-system name.',
            },
          ],
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
    // Icons are drawn, never typed (ADR 0015): no glyph characters in rendered UI.
    files: [
      'apps/web/src/**/*.{ts,tsx}',
      'packages/ui/src/**/*.{ts,tsx}',
      'modules/*/web/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.test.{ts,tsx}', 'apps/web/src/mocks/**'],
    rules: { 'bemmoly/no-glyph-characters': 'error' },
  },
  {
    // Tokens are the only source of colour and type size (docs/design/system/tokens.md).
    // Stories and tests may pass sample data, such as a label's stored colour. core-web and
    // the editor repeat this in their own configs, with paths relative to the package.
    files: ['apps/web/src/**/*.tsx', 'packages/ui/src/**/*.tsx', 'modules/*/web/**/*.tsx'],
    ignores: [
      '**/*.test.tsx',
      '**/*.stories.tsx',
      '**/test-support.tsx',
      '**/testing/**',
      'apps/web/src/mocks/**',
    ],
    rules: { 'bemmoly/no-literal-styles': 'error' },
  },
  {
    // Docs' page title (36px) and property row (12.5px) were drawn before this rule; until they
    // move onto the type scale (or the scale gains a step through an ADR), only colours are
    // checked there.
    files: ['modules/docs/web/**/*.tsx'],
    rules: { 'bemmoly/no-literal-styles': ['error', { sizes: false }] },
  },
  {
    // The one place Lucide is imported: the icon set maps it onto the design system's names.
    files: ['packages/ui/src/icons/**'],
    rules: { 'no-restricted-imports': 'off' },
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
