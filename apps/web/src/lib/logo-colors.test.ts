import { flatten } from '@bemmoly/ui/theme';
import { PRESETS, themeById } from '@bemmoly/ui/tokens';
import { siConfluence, siJira } from 'simple-icons';
import { describe, expect, it } from 'vitest';
import {
  chipsOf,
  contrastRatio,
  IMPORT_MARK_BRANDS,
  MARK_CONTRAST,
  markColor,
  markFill,
} from './logo-colors.ts';

/** The chip a mark sits on, flattened over the card. */
const chipOf = (id: string) => {
  const { colors } = themeById(id);
  return flatten(colors['line-2'], colors.card);
};

describe('logo colours', () => {
  it('keeps the import brands equal to what simple-icons publishes', () => {
    expect(IMPORT_MARK_BRANDS).toEqual({
      jira: `#${siJira.hex.toLowerCase()}`,
      confluence: `#${siConfluence.hex.toLowerCase()}`,
    });
  });

  it('draws every brand mark at 3:1 or better on every preset tile', () => {
    for (const brand of Object.values(IMPORT_MARK_BRANDS)) {
      for (const preset of PRESETS) {
        const fill = markColor(brand, preset.mode) ?? preset.neutrals.tx;
        expect(contrastRatio(fill, chipOf(preset.id))).toBeGreaterThanOrEqual(MARK_CONTRAST);
      }
    }
  });

  it('uses the brand untouched where it already reads, and a lighter shade on dark tiles', () => {
    expect(markColor(IMPORT_MARK_BRANDS.jira, 'light')).toBe('#0052cc');
    expect(markColor(IMPORT_MARK_BRANDS.confluence, 'light')).toBe('#172b4d');
    const darkJira = markColor(IMPORT_MARK_BRANDS.jira, 'dark');
    expect(darkJira).toMatch(/^#[0-9a-f]{6}$/);
    expect(darkJira).not.toBe('#0052cc');
    expect(markFill(IMPORT_MARK_BRANDS.jira)).toBe(`light-dark(#0052cc, ${darkJira})`);
  });

  it('takes the text colour rather than a washed-out shade of a dark brand', () => {
    expect(markColor(IMPORT_MARK_BRANDS.confluence, 'dark')).toBeNull();
    expect(markFill(IMPORT_MARK_BRANDS.confluence)).toBe('light-dark(#172b4d, var(--tx))');
  });

  it('gives monochrome marks (primary text) strong contrast on every preset tile', () => {
    for (const preset of PRESETS) {
      expect(contrastRatio(preset.neutrals.tx, chipOf(preset.id))).toBeGreaterThanOrEqual(4.5);
    }
    expect(chipsOf('dark')).toHaveLength(3);
  });
});
