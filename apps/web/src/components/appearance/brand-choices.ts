/**
 * The brand colours the Appearance mock offers as one-click swatches. These are
 * values a person picks and stores in appearance.brandColor, not styling for
 * the page, so they live here as data rather than as design tokens.
 */
export const BRAND_CHOICES = [
  '#f97316',
  '#e11d48',
  '#7c3aed',
  '#2356c9',
  '#0f766e',
  '#111827',
] as const;

/** The mock's starting brand when nothing is stored yet. */
export const DEFAULT_BRAND: string = BRAND_CHOICES[0];
