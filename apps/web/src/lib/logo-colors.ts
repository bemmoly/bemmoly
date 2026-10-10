import { flatten, luminance, mixHex } from '@bemmoly/ui/theme';
import { PRESETS, themeById } from '@bemmoly/ui/tokens';

type Mode = 'light' | 'dark';

/**
 * The brand colour simple-icons publishes for each import source mark (its `hex` field),
 * kept here as data so the script does not load the whole icon index; a test holds it to
 * the package. These identify a third-party mark, they are not styling for the page.
 */
export const IMPORT_MARK_BRANDS = {
  jira: '#0052cc',
  confluence: '#172b4d',
} as const;

/** WCAG 1.4.11: a graphic that identifies something needs 3:1 against what it sits on. */
export const MARK_CONTRAST = 3;

/** WCAG contrast ratio of two hex colours, from the design system's luminance. */
export function contrastRatio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

/** The tile colour of every preset in a mode: what a mark can sit on. */
export function chipsOf(mode: Mode): string[] {
  return PRESETS.filter((preset) => preset.mode === mode).map((preset) => {
    const { colors } = themeById(preset.id);
    return flatten(colors['line-2'], colors.card);
  });
}

const textOf = (mode: Mode) =>
  (PRESETS.find((preset) => preset.id === (mode === 'dark' ? 'dark' : 'light')) ?? PRESETS[0])
    .neutrals.tx;

/**
 * How far a brand may be mixed toward the text colour before it stops reading as the brand:
 * past this a navy turns slate grey, which looks disabled, so the mark takes the text colour.
 */
const MIN_BRAND_SHARE = 70;

/**
 * A brand colour that reads on every tile of a mode: the brand itself when it passes 3:1,
 * else the brand mixed toward that mode's text colour (lighter on dark, darker on light) in
 * small steps until it does. Null when that would wash the brand out; the mark then takes
 * the primary text colour, like a monochrome logo.
 */
export function markColor(brand: string, mode: Mode): string | null {
  const chips = chipsOf(mode);
  const toward = textOf(mode);
  for (let keep = 100; keep >= MIN_BRAND_SHARE; keep -= 5) {
    const shade = keep === 100 ? brand.toLowerCase() : mixHex(brand, keep, toward);
    if (chips.every((chip) => contrastRatio(shade, chip) >= MARK_CONTRAST)) return shade;
  }
  return null;
}

/** A brand mark's fill for both modes, as CSS that follows the page's color-scheme. */
export function markFill(brand: string): string {
  const fill = (mode: Mode) => markColor(brand, mode) ?? 'var(--tx)';
  return `light-dark(${fill('light')}, ${fill('dark')})`;
}
