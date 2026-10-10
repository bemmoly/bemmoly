import { boundaries } from './boundaries.js';
import { noGlyphCharacters } from './no-glyph-characters.js';
import { noLiteralStyles } from './no-literal-styles.js';

const plugin = {
  meta: { name: '@bemmoly/eslint-plugin', version: '0.0.0' },
  rules: {
    boundaries,
    'no-glyph-characters': noGlyphCharacters,
    'no-literal-styles': noLiteralStyles,
  },
};

export default plugin;
