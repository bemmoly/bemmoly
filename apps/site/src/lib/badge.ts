/**
 * @bemmoly/ui's Badge tones (packages/ui/src/components/badge/badge.tsx), for a site that
 * renders no React. Only the tones the site uses; keep the classes in step with the package.
 */
export const BADGE_TONES = {
  neutral: 'bg-line-2 text-tx-2',
  // In dark mode the accent is a step lighter on its own tint, so the text keeps 4.5:1.
  accent: 'bg-acc-50 text-acc dark:text-acc-500',
  ok: 'bg-green-50 text-green-tx',
  warn: 'bg-amber-50 text-amber-tx',
  /** AI and only AI, in the logo's lilac (ADR 0015). */
  ai: 'bg-ai-50 text-ai-600',
  solid: 'bg-acc-fill text-on-acc',
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;
