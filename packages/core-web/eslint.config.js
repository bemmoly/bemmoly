import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import root from '../../eslint.config.js';

/** Kernel UI runs in the browser like apps/web: browser globals and the hooks rules apply. */
export default [
  ...root,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // The root config's glyph rule, with paths relative to this package.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: { 'bemmoly/no-glyph-characters': 'error' },
  },
  {
    // The root config's literal colour and font size rule, with paths relative to this package.
    files: ['src/**/*.tsx'],
    ignores: ['**/*.test.tsx', '**/*.stories.tsx', 'src/testing/**'],
    rules: { 'bemmoly/no-literal-styles': 'error' },
  },
  {
    // The root config's extracted-screens rules (ADR 0025), for the kernel's frame.
    files: ['src/shell/{app-frame,bottom-bar,page-header}.tsx'],
    rules: { 'bemmoly/no-literal-ui-strings': 'error', 'bemmoly/logical-properties': 'error' },
  },
];
