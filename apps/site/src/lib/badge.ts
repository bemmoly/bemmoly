/**
 * @bemmoly/ui's Badge tones (packages/ui/src/components/badge/badge.tsx), for a site that
 * renders no React. Only the tones the site uses; keep the classes in step with the package.
 */
export const BADGE_TONES = {
  neutral: 'bg-line-2 text-tx-2',
  accent: 'bg-acc-50 text-acc',
  ok: 'bg-green-50 text-green-tx',
  warn: 'bg-amber-50 text-amber-tx',
  solid: 'bg-acc-fill text-on-acc',
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;
