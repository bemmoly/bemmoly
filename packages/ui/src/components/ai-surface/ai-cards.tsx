import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { AiDot } from './ai-parts.tsx';

export interface AiSummaryProps {
  /** "Summary", "TL;DR". */
  title?: ReactNode;
  /** Where it came from, e.g. "from 14 comments, 2 PRs". Always say what the AI read. */
  source?: ReactNode;
  children: ReactNode;
  /** AiActionButton(s) and an AiNotUseful. */
  actions?: ReactNode;
  /**
   * panel: the board drawer (7px radius, 12px 14px, 12.5px, ai-br border).
   * page: the Issue page and Doc TL;DR (8px radius, 14px 16px, 13px, lighter ai-br2 border).
   */
  variant?: 'panel' | 'page';
  className?: string;
}

/** The AI summary card. Body text stays tx so the content reads as content. */
export function AiSummary({
  title = 'Summary',
  source,
  children,
  actions,
  variant = 'panel',
  className,
}: AiSummaryProps) {
  const panel = variant === 'panel';
  return (
    <section
      aria-label={typeof title === 'string' ? `AI ${title.toLowerCase()}` : 'AI summary'}
      className={cx(
        'flex flex-col gap-2 bg-ai-bg',
        panel
          ? 'rounded-panel border border-ai-br px-3.5 py-3 text-12h leading-body'
          : 'rounded-card border border-ai-br2 px-4 py-3.5 leading-brief',
        className,
      )}
    >
      <div className="flex items-center gap-1.75 font-semibold text-ai">
        <AiDot />
        {title}
        {source && <span className="ml-auto text-11h font-normal text-ai-mute">{source}</span>}
      </div>
      <div className="text-tx">{children}</div>
      {actions && (
        // The mock's action chips inherit the card's line height (1.5 panel, 1.55 page).
        <div
          className={cx(
            'flex flex-wrap gap-1.5 pt-0.5',
            panel ? '[&>button]:leading-body' : '[&>button]:leading-brief',
          )}
        >
          {actions}
        </div>
      )}
    </section>
  );
}

export interface AiInsightBarProps {
  /** "Sprint risk", "Flow risk". */
  title: ReactNode;
  children: ReactNode;
  /** Usually two Button size="xs". */
  actions?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/** The Board's risk bar: white, ai-br border with a 3px AI rule on the left, one line. */
export function AiInsightBar({
  title,
  children,
  actions,
  onDismiss,
  className,
}: AiInsightBarProps) {
  return (
    <section
      aria-label={typeof title === 'string' ? title : 'AI insight'}
      className={cx(
        'flex items-center gap-3 rounded-control border border-l-3 border-ai-br border-l-ai bg-sf py-2.25 pr-3 pl-3.5 text-12h',
        className,
      )}
    >
      <span className="flex shrink-0 items-center gap-1.75 font-semibold whitespace-nowrap text-ai">
        <AiDot />
        {title}
      </span>
      <span className="min-w-0 truncate text-tx2">{children}</span>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        {actions}
        {onDismiss && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className={cx(
              'cursor-pointer border-0 bg-transparent px-2 py-1.25 font-semibold text-tx5 hover:text-tx2',
              focusRing,
            )}
          >
            ✕
          </button>
        )}
      </div>
    </section>
  );
}

export interface AiBriefProps {
  title: ReactNode;
  /** What it was built from, e.g. "built from 31 updates since Friday". */
  source?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Home's morning brief: white, ai-br2 border, 3px AI rule, 13.5px body in ai-tx at 1.6. */
export function AiBrief({ title, source, children, actions, className }: AiBriefProps) {
  return (
    <section
      aria-label={typeof title === 'string' ? title : 'AI brief'}
      className={cx(
        'flex flex-col gap-2 rounded-panel border border-l-3 border-ai-br2 border-l-ai bg-sf px-4 py-3.5',
        className,
      )}
    >
      <div className="flex items-center gap-2 font-semibold text-ai">
        <AiDot />
        {title}
        {source && <span className="text-12 font-normal text-tx5">{source}</span>}
      </div>
      <div className="max-w-225 text-13h leading-desc text-ai-tx">{children}</div>
      {actions && <div className="flex flex-wrap gap-1.5">{actions}</div>}
    </section>
  );
}

export interface AiSuggestionProps {
  children: ReactNode;
  /** Runs the suggestion. Label it with the verb: "Apply", "Move both", "Do it". */
  onAccept: () => void;
  acceptLabel?: string;
  onDismiss: () => void;
  dismissLabel?: string;
  /** row: inside a list (Backlog sprint tip). card: free-standing (doc comment reply). */
  variant?: 'row' | 'card';
  className?: string;
}

/** A suggestion with Do it / Dismiss: AI tint, 7px dot, ai-tx text, AI action, tx5 dismiss. */
export function AiSuggestion({
  children,
  onAccept,
  acceptLabel = 'Do it',
  onDismiss,
  dismissLabel = 'Dismiss',
  variant = 'row',
  className,
}: AiSuggestionProps) {
  return (
    <div
      role="note"
      aria-label="AI suggestion"
      className={cx(
        'flex items-center gap-2.5 bg-ai-bg text-12h',
        variant === 'row'
          ? 'border-b border-br2 px-3.5 py-2'
          : 'rounded-panel border border-ai-br2 px-3 py-2.5 leading-note',
        className,
      )}
    >
      <AiDot />
      <span className="min-w-0 flex-1 text-ai-tx">{children}</span>
      <button
        type="button"
        onClick={onAccept}
        className={cx(
          'shrink-0 cursor-pointer rounded-xs border border-ai-br bg-sf px-2.25 py-1 font-sans text-12h font-medium text-ai hover:bg-ai-bg',
          focusRing,
        )}
      >
        {acceptLabel}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className={cx(
          'shrink-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-12h text-tx5 hover:text-tx2',
          focusRing,
        )}
      >
        {dismissLabel}
      </button>
    </div>
  );
}
