import { Icon, type IconName } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';

export type ResultTone = 'ok' | 'warn' | 'red';

const TONES: Record<ResultTone, { look: string; icon: IconName; mark: string }> = {
  ok: { look: 'border-green bg-green-50', icon: 'circle-check', mark: 'text-green-tx' },
  warn: { look: 'border-amber bg-amber-50', icon: 'warning', mark: 'text-amber-tx' },
  red: { look: 'border-red bg-red-50', icon: 'alert', mark: 'text-red-tx' },
};

interface ResultAlertProps {
  tone: ResultTone;
  /** The bold first sentence: "All 12 projects imported." */
  headline: string;
  children?: ReactNode;
  /** Retry, beside the words; wraps under them on a phone. */
  action?: ReactNode;
}

/** How an import ended, or that it runs in the background: a tinted line and its action. */
export function ResultAlert({ tone, headline, children, action }: ResultAlertProps) {
  const look = TONES[tone];
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border px-3.5 py-3 text-13 leading-body text-tx ${look.look}`}
    >
      <span className={`flex shrink-0 self-start pt-0.5 ${look.mark}`}>
        <Icon name={look.icon} size={16} />
      </span>
      <p className="m-0 min-w-0 flex-1">
        <span className="font-semibold">{headline}</span> {children}
      </p>
      {action ? <span className="flex shrink-0 max-sm:w-full max-sm:ps-7">{action}</span> : null}
    </div>
  );
}
