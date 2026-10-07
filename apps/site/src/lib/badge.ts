/**
 * @bemmoly/ui's Badge tones (packages/ui/src/components/badge/badge.tsx), for a site that
 * renders no React. Only the tones the site uses; keep the classes in step with the package.
 */
export const BADGE_TONES = {
  neutral: 'bg-chip text-tx3',
  accent: 'bg-ac-bg text-ac',
  ok: 'bg-ok-bg text-ok-fg',
  warn: 'bg-warn-bg text-warn-fg',
  solid: 'bg-ac-fill text-on-ac',
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;
