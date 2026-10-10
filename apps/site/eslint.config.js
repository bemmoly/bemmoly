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
    // Icons are drawn, never typed (ADR 0015): the product's rule, on the site's pages too.
    files: ['src/**/*.{astro,ts}'],
    rules: { 'bemmoly/no-glyph-characters': 'error' },
  },
  {
    // Colours come from the product's tokens (docs/design/system/marketing-site.md); display
    // sizes are declared once in site.css, so no literal colour or font size on a page.
    files: ['src/**/*.{astro,ts}'],
    rules: { 'bemmoly/no-literal-styles': 'error' },
  },
  {
    // The site's icon set: the product's icons plus the few a marketing page needs, from the
    // same Lucide release. The one file here that may import Lucide.
    files: ['src/lib/icons.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
);
