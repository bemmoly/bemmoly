import type { CSSProperties } from 'react';
import { cx } from '../../lib/cx.ts';
import { BRAND_FILES, decorative, type LogoVariant } from './brand-files.ts';

export type LogoTone = 'auto' | 'light' | 'dark' | 'mono';

export interface LogoProps {
  variant?: LogoVariant;
  /**
   * auto: the -color files, which follow the active theme (tile in the accent fill, letter in
   * on-accent, wordmark in the text colour), so every preset and custom theme is right.
   * light: for dark backgrounds. dark: for light backgrounds. mono: one colour, currentColor.
   */
  tone?: LogoTone;
  /** Height in px. The files are drawn 24 tall, the top bar size. */
  size?: number;
  /** Accessible name; pass "" when a visible name sits next to the mark. */
  label?: string;
  className?: string;
}

const THEME_VARS = {
  '--brand-mark-bg': 'var(--ac-fill)',
  '--brand-mark-fg': 'var(--on-ac)',
} as CSSProperties;

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
      className={cx('inline-flex shrink-0 text-tx [&>svg]:h-full [&>svg]:w-auto', className)}
      style={{ ...THEME_VARS, height: size }}
      dangerouslySetInnerHTML={{ __html: decorative(svg) }}
    />
  );
}
