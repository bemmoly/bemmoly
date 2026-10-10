import { StatusGlyph, type StatusStage } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';

export type PillTone = 'ok' | 'warn' | 'red' | 'acc' | 'neutral';

const TONES: Record<PillTone, string> = {
  ok: 'bg-green-50 text-green-tx',
  warn: 'bg-amber-50 text-amber-tx',
  red: 'bg-red-50 text-red-tx',
  acc: 'bg-acc-50 text-acc',
  neutral: 'bg-sunken text-tx-2 shadow-[inset_0_0_0_1px_var(--line)]',
};

interface StatePillProps {
  tone: PillTone;
  children: ReactNode;
  /** A drawn icon before the words; never a typed character. */
  icon?: IconName;
  /** Or a status circle, for states that move from not started to done. */
  stage?: StatusStage;
}

/**
 * The review's chip for a state ("Enabled", "Verified", "Failed"): sentence case, 12px medium
 * on a tint of its signal colour, with an optional drawn icon or status circle.
 */
export function StatePill({ tone, children, icon, stage }: StatePillProps) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center gap-1 rounded-chip px-1.75 text-12 font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {stage ? <StatusGlyph stage={stage} size={12} /> : null}
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}
