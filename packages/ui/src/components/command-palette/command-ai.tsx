import { useId, type ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { AiDot } from '../ai-surface/ai-parts.tsx';
import { Button } from '../button/button.tsx';
import { Kbd } from '../kbd/kbd.tsx';
import { Skeleton } from '../skeleton/skeleton.tsx';

/*
 * The palette's AI parts, drawn only when AI is on: the AI line (the option that hands the
 * typed words to Bemmoly), the thinking state, and the honest notices (provider down, budget
 * spent, nothing to change).
 */

export interface CommandAiLineProps {
  /** "Plan with Bemmoly" for a request, "Ask Bemmoly" for a question. */
  label: string;
  query: string;
  /** The key that does the same from anywhere in the palette. */
  keys?: string;
  onSelect: () => void;
}

/** A result row in lilac: the typed words, quoted, and what choosing it does. */
export function CommandAiLine({ label, query, keys = 'Mod+Enter', onSelect }: CommandAiLineProps) {
  const id = useId();
  return (
    <div
      id={id}
      role="option"
      aria-selected="false"
      onClick={onSelect}
      className="flex h-9.5 shrink-0 cursor-pointer items-center gap-2.5 rounded-card px-3.5 text-tx aria-selected:bg-ai-50 motion-safe:transition-colors motion-safe:duration-(--duration-instant)"
    >
      <span aria-hidden className="grid w-4.5 shrink-0 place-items-center">
        <AiDot size={8} />
      </span>
      <span className="shrink-0 font-medium text-ai-600">{label}</span>
      <span className="min-w-0 flex-1 truncate text-tx-2">“{query}”</span>
      <span className="hidden shrink-0 gap-1 sm:flex">
        {keys.split(' ').map((key) => (
          <Kbd key={key} keys={key} />
        ))}
      </span>
    </div>
  );
}

/** The plan or answer on its way: the layout it will take, pulsing, with a way out. */
export function CommandAiThinking({
  label = 'Drawing up a plan',
  onCancel,
}: {
  label?: string;
  onCancel?: () => void;
}) {
  return (
    <section
      aria-label={label}
      aria-busy
      className="flex flex-col gap-3 border-b border-line-2 bg-ai-50 px-4 py-3.5"
    >
      <div className="flex items-center gap-2 text-13 font-semibold text-ai-600">
        <AiDot className="motion-safe:animate-pulse" />
        <span role="status">{label}…</span>
        {onCancel && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onCancel}>
            Stop
          </Button>
        )}
      </div>
      <Skeleton width="72%" />
      <div className="flex flex-col gap-2.5 rounded-control border border-ai-100 bg-card px-3 py-3">
        {[64, 82, 56].map((width) => (
          <span key={width} className="flex items-center gap-3">
            <Skeleton width={56} />
            <Skeleton width={`${width}%`} />
          </span>
        ))}
      </div>
    </section>
  );
}

export interface CommandAiNoticeProps {
  title: ReactNode;
  children?: ReactNode;
  /** `problem` for a failure (provider down, budget spent); `note` for an honest non-answer. */
  tone?: 'note' | 'problem';
  action?: { label: string; onClick: () => void; keys?: string };
}

/** One sentence of what happened and what to do next, inside the AI card. */
export function CommandAiNotice({ title, children, tone = 'note', action }: CommandAiNoticeProps) {
  return (
    <section
      aria-label="Bemmoly"
      role={tone === 'problem' ? 'alert' : undefined}
      className="flex flex-col gap-2 border-b border-line-2 bg-ai-50 px-4 py-3.5"
    >
      <div className="flex items-center gap-2 text-13 font-semibold text-ai-600">
        {tone === 'problem' ? <Icon name="warning" size={14} /> : <AiDot />}
        {title}
      </div>
      {children && <div className={cx('text-13 leading-brief text-tx')}>{children}</div>}
      {action && (
        <div>
          <Button size="sm" onClick={action.onClick}>
            {action.label}
            {action.keys && <Kbd keys={action.keys} variant="plain" />}
          </Button>
        </div>
      )}
    </section>
  );
}
