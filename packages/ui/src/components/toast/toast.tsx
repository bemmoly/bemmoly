import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { IconButton } from '../button/icon-button.tsx';

export type ToastTone = 'info' | 'ok' | 'warn' | 'danger' | 'ai';

const DOTS: Record<ToastTone, string> = {
  info: 'bg-ac',
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  ai: 'bg-ai',
};

export interface ToastProps {
  tone?: ToastTone;
  /** What happened, in plain words. */
  title: ReactNode;
  /** The consequence and what happens next, e.g. "I'll retry in 30 seconds." */
  body?: ReactNode;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
  className?: string;
}

/**
 * No mock shows a toast. It is built from the mocks' notice row (7px dot, 12.5px text at 1.45)
 * on the menu surface (8px radius, shadow-menu). AI toasts use the reserved AI tokens.
 */
export function Toast({ tone = 'info', title, body, action, onDismiss, className }: ToastProps) {
  const ai = tone === 'ai';
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx(
        'flex w-90 items-start gap-2.5 rounded-card border px-3 py-2.5 text-12h leading-note shadow-menu',
        ai ? 'border-ai-br2 bg-ai-bg' : 'border-br bg-sf',
        className,
      )}
    >
      <span aria-hidden className={cx('mt-1.25 size-1.75 shrink-0 rounded-full', DOTS[tone])} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cx('font-semibold', ai ? 'text-ai-600' : 'text-tx')}>{title}</span>
        {body && <span className={ai ? 'text-ai-tx' : 'text-tx2'}>{body}</span>}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-1 cursor-pointer self-start border-0 bg-transparent p-0 font-sans text-12h font-medium text-ac hover:text-ac-d focus-ring"
          >
            {action.label}
          </button>
        )}
      </div>
      {onDismiss && (
        <IconButton
          label="Dismiss"
          icon="close"
          size="xs"
          className="-my-1 -mr-1 text-tx5"
          onClick={onDismiss}
        />
      )}
    </div>
  );
}
