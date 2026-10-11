import { boundaries } from './boundaries.js';
import { noAtlassianMarks } from './no-atlassian-marks.js';
import { logicalProperties } from './logical-properties.js';
import { noGlyphCharacters } from './no-glyph-characters.js';
import { noLiteralStyles } from './no-literal-styles.js';
import { noLiteralUiStrings } from './no-literal-ui-strings.js';

const plugin = {
  meta: { name: '@bemmoly/eslint-plugin', version: '0.0.0' },
  rules: {
    boundaries,
    'logical-properties': logicalProperties,
    'no-atlassian-marks': noAtlassianMarks,
    'no-glyph-characters': noGlyphCharacters,
    'no-literal-styles': noLiteralStyles,
    'no-literal-ui-strings': noLiteralUiStrings,
  },
};

export default plugin;
