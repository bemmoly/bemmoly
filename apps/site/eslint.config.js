// The repository's rules, plus .astro files so the size limit and the rest apply to them.
import astro from 'eslint-plugin-astro';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import root from '../../eslint.config.js';

export default defineConfig(
  { ignores: ['.astro/**'] },
  root,
  astro.configs.recommended,
  {
    files: ['src/**/*.{astro,ts}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
);
