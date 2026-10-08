import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRingInset } from '../../lib/focus.ts';
import { Badge } from '../badge/badge.tsx';
import { Button } from '../button/button.tsx';
import { IconButton } from '../button/icon-button.tsx';

export interface SprintCounts {
  todo: number;
  doing: number;
  done: number;
}

export interface SprintHeaderProps {
  name: ReactNode;
  /** "Sep 23 – Oct 7", after the name in 12.5px tx4. */
  dates?: ReactNode;
  /** The sprint goal, after the dates the way the Board header lists it. */
  goal?: ReactNode;
  active?: boolean;
  issueCount: number;
  /** The three mono pills: to do (chip), in progress (accent), done (ok). */
  counts: SprintCounts;
  /** "23 pts · 14 done" or a CapacityBar; shown before the action. */
  capacity?: ReactNode;
  /** "Start sprint", "Complete sprint" or "Create sprint". */
  action?: ReactNode;
  onAction?: () => void;
  onMore?: () => void;
  open: boolean;
  onToggle: () => void;
  /** The id of the container body the chevron controls. */
  controls?: string;
  className?: string;
}

/**
 * The Backlog's sprint container heading: 10px 14px on sf2 over a br-row rule, the chevron,
 * the name at 13.5px semibold, dates, the ACTIVE badge, the issue count, then the status pills
 * 6px apart, the capacity text, the 28px action and the more button.
 */
export function SprintHeader({
  name,
  dates,
  goal,
  active = false,
  issueCount,
  counts,
  capacity,
  action,
  onAction,
  onMore,
  open,
  onToggle,
  controls,
  className,
}: SprintHeaderProps) {
  return (
    <div
      className={cx(
        'flex items-center gap-2.5 border-b border-br-row bg-sf2 px-3.5 py-2.5 text-13 text-tx',
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={controls}
        onClick={onToggle}
        className={cx(
          'flex min-w-0 cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 text-left font-sans text-13 text-tx',
          focusRingInset,
        )}
      >
        <Icon
          name="chevron"
          size={10}
          className={cx('w-2.5 text-tx5 motion-safe:transition-transform', open && 'rotate-90')}
        />
        <span className="text-13h font-semibold">{name}</span>
        {dates && <span className="text-12h text-tx4">{dates}</span>}
        {goal && <span className="text-12h text-tx4">· {goal}</span>}
      </button>
      {active && <Badge tone="ok">ACTIVE</Badge>}
      <span className="text-12h text-tx5">{issueCount} issues</span>
      <span className="ml-auto flex items-center gap-1.5">
        <Badge variant="count" title="To do" aria-label={`${counts.todo} to do`}>
          {counts.todo}
        </Badge>
        <Badge
          variant="count"
          tone="accent"
          title="In progress"
          aria-label={`${counts.doing} in progress`}
        >
          {counts.doing}
        </Badge>
        <Badge variant="count" tone="ok" title="Done" aria-label={`${counts.done} done`}>
          {counts.done}
        </Badge>
        {capacity && <span className="ml-1.5 text-12 text-tx4">{capacity}</span>}
        {action && (
          <Button size="xs" className="ml-2" onClick={onAction}>
            {action}
          </Button>
        )}
        {onMore && <IconButton label="Sprint actions" icon="more" size="xs" onClick={onMore} />}
      </span>
    </div>
  );
}

export interface SprintContainerProps {
  header: ReactNode;
  /** The active sprint carries the accent border; others the plain br. */
  active?: boolean;
  open: boolean;
  id?: string;
  children?: ReactNode;
  className?: string;
}

/** A sprint or the backlog: an 8px card with its header and the rows, 16px above the next. */
export function SprintContainer({
  header,
  active = false,
  open,
  id,
  children,
  className,
}: SprintContainerProps) {
  return (
    <section
      className={cx(
        'overflow-hidden rounded-card border bg-sf',
        active ? 'border-ac-br' : 'border-br',
        className,
      )}
    >
      {header}
      {open && (
        <div id={id} className="flex flex-col">
          {children}
        </div>
      )}
    </section>
  );
}
