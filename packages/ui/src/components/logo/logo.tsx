import type { CSSProperties } from 'react';
import { cx } from '../../lib/cx.ts';
import { mixCss } from '../../theme/color.ts';
import { BRAND_FILES, decorative, type LogoVariant } from './brand-files.ts';

export type LogoTone = 'auto' | 'light' | 'dark' | 'mono';

export interface LogoProps {
  variant?: LogoVariant;
  /**
   * auto: the -color files: the designed blue, mid blue and lilac tiles on every preset, the
   * workspace's brand colour and its tints under a custom theme, the wordmark in the text colour.
   * light: for dark backgrounds. dark: for light backgrounds. mono: one colour, currentColor.
   */
  tone?: LogoTone;
  /** Height in px. The files are drawn 24 tall, the top bar size. */
  size?: number;
  /** Accessible name; pass "" when a visible name sits next to the mark. */
  label?: string;
  className?: string;
}

/**
 * A custom brand recolours the tiles: the brand colour, its light tone, and a tint 55% of the
 * way to the surface (white in light mode, the dark surface in dark mode). Presets keep the
 * designed colours, which the file carries as each tile's own fill.
 */
const BRAND_VARS = {
  '--brand-mark-bg': 'var(--ac)',
  '--brand-mark-mid': 'var(--ac-l)',
  '--brand-mark-fg': mixCss('var(--ac)', 45, 'var(--sf)'),
} as CSSProperties;

const BRAND_FILLS = [
  'in-data-[theme=custom]:[&_.brand-mark-bg]:fill-(--brand-mark-bg)',
  'in-data-[theme=custom]:[&_.brand-mark-mid]:fill-(--brand-mark-mid)',
  'in-data-[theme=custom]:[&_.brand-mark-fg]:fill-(--brand-mark-fg)',
];

/** The only component that draws the Bemmoly logo. It renders the files in assets/brand. */
export function Logo({
  variant = 'mark',
  tone = 'auto',
  size = 24,
  label = 'Bemmoly',
  className,
}: LogoProps) {
  const svg = BRAND_FILES[variant][tone === 'auto' ? 'color' : tone];
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <span
      {...a11y}
      className={cx(
        'inline-flex shrink-0 text-tx [&>svg]:h-full [&>svg]:w-auto',
        ...BRAND_FILLS,
        className,
      )}
      style={{ ...BRAND_VARS, height: size }}
      dangerouslySetInnerHTML={{ __html: decorative(svg) }}
    />
  );
}
