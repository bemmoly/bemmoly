import { cx } from '../../lib/cx.ts';
import { BRAND_FILES, decorative, trimmed, type LogoVariant } from './brand-files.ts';

export type LogoTone = 'auto' | 'light' | 'dark' | 'mono';

export interface LogoProps {
  variant?: LogoVariant;
  /**
   * auto: the -color files: the designed blue, mid blue and lilac tiles on every preset and
   * every custom theme (ADR 0015: themes never recolour the mark), the wordmark in the text colour.
   * light: for dark backgrounds. dark: for light backgrounds. mono: one colour, currentColor.
   */
  tone?: LogoTone;
  /** Height in px. The files are drawn 24 tall, the top bar size. */
  size?: number;
  /** Accessible name; pass "" when a visible name sits next to the mark. */
  label?: string;
  /** Crop the file to its ink, so `size` is the height of the letters (the brand block). */
  trim?: boolean;
  className?: string;
}

/** The only component that draws the Bemmoly logo. It renders the files in assets/brand. */
export function Logo({
  variant = 'mark',
  tone = 'auto',
  size = 24,
  label = 'Bemmoly',
  trim,
  className,
}: LogoProps) {
  const file = BRAND_FILES[variant][tone === 'auto' ? 'color' : tone];
  const svg = trim ? trimmed(file) : file;
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <span
      {...a11y}
      className={cx('inline-flex shrink-0 text-tx [&>svg]:h-full [&>svg]:w-auto', className)}
      style={{ height: size }}
      dangerouslySetInnerHTML={{ __html: decorative(svg) }}
    />
  );
}
