import { flatten } from '@bemmoly/ui/theme';
import { resolveTheme, THEME_SOURCES } from '@bemmoly/ui/tokens';
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
const chipOf = (id: string, mode: 'light' | 'dark') => {
  const { colors } = resolveTheme(id, mode);
  return flatten(colors['line-2'], colors.card);
};

const LOOKS = THEME_SOURCES.flatMap((source) =>
  (['light', 'dark'] as const).map((mode) => ({ id: source.id, mode, tx: source[mode].tx })),
);

describe('logo colours', () => {
  it('keeps the import brands equal to what simple-icons publishes', () => {
    expect(IMPORT_MARK_BRANDS).toEqual({
      jira: `#${siJira.hex.toLowerCase()}`,
      confluence: `#${siConfluence.hex.toLowerCase()}`,
    });
  });

  it('draws every brand mark at 3:1 or better on every theme tile, in both modes', () => {
    for (const brand of Object.values(IMPORT_MARK_BRANDS)) {
      for (const look of LOOKS) {
        const fill = markColor(brand, look.mode) ?? look.tx;
        expect(contrastRatio(fill, chipOf(look.id, look.mode))).toBeGreaterThanOrEqual(
          MARK_CONTRAST,
        );
      }
    }
  });

  it('uses the brand untouched where it already reads, and never itself on dark tiles', () => {
    expect(markColor(IMPORT_MARK_BRANDS.jira, 'light')).toBe('#0052cc');
    expect(markColor(IMPORT_MARK_BRANDS.confluence, 'light')).toBe('#172b4d');
    const darkJira = markColor(IMPORT_MARK_BRANDS.jira, 'dark');
    expect(darkJira === null || /^#[0-9a-f]{6}$/.test(darkJira)).toBe(true);
    expect(darkJira).not.toBe('#0052cc');
    expect(markFill(IMPORT_MARK_BRANDS.jira)).toBe(
      `light-dark(#0052cc, ${darkJira ?? 'var(--tx)'})`,
    );
  });

  it('takes the text colour rather than a washed-out shade of a dark brand', () => {
    expect(markColor(IMPORT_MARK_BRANDS.confluence, 'dark')).toBeNull();
    expect(markFill(IMPORT_MARK_BRANDS.confluence)).toBe('light-dark(#172b4d, var(--tx))');
  });

  it('gives monochrome marks (primary text) strong contrast on every theme tile', () => {
    for (const look of LOOKS) {
      expect(contrastRatio(look.tx, chipOf(look.id, look.mode))).toBeGreaterThanOrEqual(4.5);
    }
    expect(chipsOf('dark')).toHaveLength(5);
  });
});
