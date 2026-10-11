import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRingInset } from '../../lib/focus.ts';
import { Button } from '../button/button.tsx';
import { IconButton } from '../button/icon-button.tsx';

export interface SprintPoints {
  done: number;
  /** Points on issues in progress: the blue part of the bar. */
  doing: number;
  total: number;
}

export interface SprintProgressProps extends SprintPoints {
  className?: string;
}

/**
 * The two-tone sprint bar: done in green, in progress in blue, on the line colour. It reads
 * aloud as "9 of 48 points done, 11 in progress".
 */
export function SprintProgress({ done, doing, total, className }: SprintProgressProps) {
  const share = (n: number) => (total > 0 ? `${Math.min(100, (n / total) * 100)}%` : '0%');
  return (
    <span
      role="img"
      aria-label={`${done} of ${total} points done, ${doing} in progress`}
      title={`${done} done · ${doing} in progress · ${Math.max(0, total - done - doing)} to do`}
      className={cx('flex h-1 overflow-hidden rounded-[2px] bg-line', className)}
    >
      <i className="block h-full bg-done" style={{ width: share(done) }} />
      <i className="block h-full bg-prog" style={{ width: share(doing) }} />
    </span>
  );
}

export type SprintKind = 'active' | 'future' | 'backlog';

export interface SprintHeaderProps {
  name: string;
  kind: SprintKind;
  /** "Sep 23 – Oct 7". */
  dates?: ReactNode;
  /** The sprint goal, shown after the dates; long goals truncate with a tooltip. */
  goal?: string;
  issueCount: number;
  /** Done, in-progress and total points; draws the bar and "9 / 48 pts". */
  points?: SprintPoints;
  /** Planned sprints: a capacity line instead of the bar. */
  capacity?: ReactNode;
  /** "Complete sprint", "Start sprint" or "Create sprint". */
  action?: ReactNode;
  onAction?: () => void;
  onMore?: () => void;
  open: boolean;
  onToggle: () => void;
  /** The id of the container body the chevron controls. */
  controls?: string;
  className?: string;
}

const CHIPS: Record<SprintKind, { label: string; className: string } | null> = {
  active: { label: 'Active', className: 'bg-acc-50 text-acc' },
  future: { label: 'Planned', className: 'bg-sunken text-tx-2 ring-1 ring-line ring-inset' },
  backlog: null,
};

/**
 * A sprint or the backlog in the list (docs/design/premium/kit.css, `.grp`): the chevron, the
 * sprint target or the backlog icon, the name, a status chip, the dates and goal, the issue
 * count, then the two-tone bar, the points and one action. Nothing is an unlabelled number.
 */
export function SprintHeader({
  name,
  kind,
  dates,
  goal,
  issueCount,
  points,
  capacity,
  action,
  onAction,
  onMore,
  open,
  onToggle,
  controls,
  className,
}: SprintHeaderProps) {
  const chip = CHIPS[kind];
  return (
    <div
      className={cx(
        'flex h-9 items-center gap-2 border-y border-line bg-sunken pr-6 pl-4 text-13 font-semibold whitespace-nowrap text-tx max-sm:pr-3 max-sm:pl-3',
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={controls}
        onClick={onToggle}
        className={cx(
          'flex min-w-0 cursor-pointer items-center gap-2 rounded-chip border-0 bg-transparent p-0 text-left font-sans text-13 font-semibold text-tx max-sm:min-w-20',
          focusRingInset,
        )}
      >
        <Icon
          name="chevron"
          size={14}
          className={cx('text-tx-3 motion-safe:transition-transform', open && 'rotate-90')}
        />
        <Icon
          name={kind === 'backlog' ? 'backlog' : 'target'}
          size={15}
          className={kind === 'active' ? 'text-acc' : 'text-tx-3'}
        />
        <span className="truncate">{name}</span>
      </button>
      {chip && (
        <span
          className={cx(
            'inline-flex h-4.5 shrink-0 items-center rounded-chip px-1.5 text-11 font-semibold max-sm:hidden',
            chip.className,
          )}
        >
          {chip.label}
        </span>
      )}
      <span className="min-w-0 truncate font-normal text-tx-3 max-sm:hidden" title={goal}>
        {[dates, `${issueCount} ${issueCount === 1 ? 'issue' : 'issues'}`]
          .filter(Boolean)
          .map((part, index) => (
            <span key={index}>
              {index > 0 && ' · '}
              {part}
            </span>
          ))}
        {goal && <span> · {goal}</span>}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-2.5 font-normal">
        {points && points.total > 0 && (
          <>
            <SprintProgress {...points} className="w-22.5 max-sm:hidden" />
            <span className="text-tx-3 tabular-nums">
              {points.done} / {points.total} pts
            </span>
          </>
        )}
        {capacity && <span className="text-12 text-tx-3 tabular-nums">{capacity}</span>}
        {action && (
          <Button size="xs" onClick={onAction}>
            {action}
          </Button>
        )}
        {onMore && <IconButton label="Sprint actions" icon="more" size="tool" onClick={onMore} />}
      </span>
    </div>
  );
}

export interface SprintContainerProps {
  header: ReactNode;
  open: boolean;
  id?: string;
  children?: ReactNode;
  className?: string;
}

/** A sprint or the backlog: its header over the rows, flush with the list's edges. */
export function SprintContainer({ header, open, id, children, className }: SprintContainerProps) {
  return (
    <section className={cx('-mt-px', className)}>
      {header}
      {open && (
        <div id={id} className="flex flex-col">
          {children}
        </div>
      )}
    </section>
  );
}
