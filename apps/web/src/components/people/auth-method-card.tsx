import { Card } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { StatePill, type PillTone } from '../settings/state-pill.tsx';

export interface AuthMethodCardProps {
  /** The 32px tile: a provider's mark or a glyph. */
  tile: ReactNode;
  name: string;
  state: { tone: PillTone; label: string };
  description: ReactNode;
  /** Highlighted border for a method people can use right now. */
  active?: boolean;
  actions?: ReactNode;
}

/** One sign-in method, as the mock draws it: tile, name, state, a sentence and its actions. */
export function AuthMethodCard({
  tile,
  name,
  state,
  description,
  active,
  actions,
}: AuthMethodCardProps) {
  return (
    <Card className={`flex min-w-0 flex-col gap-2.5 p-4 ${active ? 'border-acc-100!' : ''}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        {tile}
        <span className="min-w-0 truncate text-14 font-semibold">{name}</span>
        <span className="ml-auto">
          <StatePill tone={state.tone}>{state.label}</StatePill>
        </span>
      </div>
      <div className="text-13 leading-body text-tx-3">{description}</div>
      {actions ? <div className="mt-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </Card>
  );
}
