/**
 * The brand files in assets/brand are the source of truth for the logo; this module only loads
 * them. Replacing a file replaces the logo everywhere (see assets/brand/README.md).
 */
import lockupColor from '../../../assets/brand/lockup-color.svg?raw';
import lockupDark from '../../../assets/brand/lockup-dark.svg?raw';
import lockupLight from '../../../assets/brand/lockup-light.svg?raw';
import lockupMono from '../../../assets/brand/lockup-mono.svg?raw';
import markColor from '../../../assets/brand/mark-color.svg?raw';
import markDark from '../../../assets/brand/mark-dark.svg?raw';
import markLight from '../../../assets/brand/mark-light.svg?raw';
import markMono from '../../../assets/brand/mark-mono.svg?raw';
import wordmarkColor from '../../../assets/brand/wordmark-color.svg?raw';
import wordmarkDark from '../../../assets/brand/wordmark-dark.svg?raw';
import wordmarkLight from '../../../assets/brand/wordmark-light.svg?raw';
import wordmarkMono from '../../../assets/brand/wordmark-mono.svg?raw';

export type LogoVariant = 'mark' | 'wordmark' | 'lockup';
export type LogoFileTone = 'color' | 'light' | 'dark' | 'mono';

export const BRAND_FILES: Record<LogoVariant, Record<LogoFileTone, string>> = {
  mark: { color: markColor, light: markLight, dark: markDark, mono: markMono },
  wordmark: { color: wordmarkColor, light: wordmarkLight, dark: wordmarkDark, mono: wordmarkMono },
  lockup: { color: lockupColor, light: lockupLight, dark: lockupDark, mono: lockupMono },
};

/** The file's markup made decorative, since the Logo wrapper carries the accessible name. */
export function decorative(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/, (_match, attrs: string) => {
    const kept = attrs.replace(/\s(role|aria-label|aria-hidden|focusable)="[^"]*"/g, '');
    return `<svg${kept} aria-hidden="true" focusable="false">`;
  });
}
