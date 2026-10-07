import type { ReactNode } from 'react';

/** PLACEHOLDER for @bemmoly/ui Badge: "RECOMMENDED", "CONNECTED", "NOT SET UP", "ALLOWED". */
export type BadgeTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-chip text-tx3',
  accent: 'bg-ac-bg text-ac',
  ok: 'bg-ok-bg text-ok-fg',
  warn: 'bg-warn-bg text-warn-fg',
  danger: 'bg-danger-bg text-danger-fg',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-chip px-1.75 py-0.5 text-mono font-semibold uppercase ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
