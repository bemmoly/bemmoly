import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';

export type CircleTone = 'ok' | 'caution' | 'danger';

const LOOK: Record<CircleTone, { bg: string; mark: ReactNode; label: string }> = {
  ok: { bg: 'bg-green', mark: <Icon name="check" size={10} />, label: 'OK' },
  caution: { bg: 'bg-amber', mark: '!', label: 'Needs attention' },
  danger: { bg: 'bg-red', mark: <Icon name="close" size={10} />, label: 'Failed' },
};

/** The 16px check circle of the Setup mock's first step (10px glyph on ok, caution or danger). */
export function StatusCircle({ tone }: { tone: CircleTone }) {
  const look = LOOK[tone];
  return (
    <span
      role="img"
      aria-label={look.label}
      className={`flex size-4 shrink-0 items-center justify-center rounded-full text-11 text-on-solid ${look.bg}`}
    >
      <span aria-hidden="true" className="inline-flex">
        {look.mark}
      </span>
    </span>
  );
}
