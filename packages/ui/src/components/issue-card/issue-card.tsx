import type { KeyboardEvent, ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { PriorityGlyph, TypeGlyph, type IssueTypeRef, type Priority } from '../glyphs/glyphs.tsx';
import { Label, type LabelValue } from '../label/label.tsx';
import { BlockedChip, IssueAssignee, Points, type CardPerson } from './issue-atoms.tsx';

export interface IssueCardProps {
  issueKey: string;
  title: ReactNode;
  type: IssueTypeRef;
  priority: Priority;
  /** The assignee; null draws the unassigned ring, undefined leaves the slot out. */
  assignee?: CardPerson | null;
  /** Names, or stored labels with their colour. */
  labels?: readonly (string | LabelValue)[];
  /** Story points (Scrum) in the sunken pill; omit on Kanban boards. */
  estimate?: number | string;
  /** Time in column (Kanban): the label and whether it is past the column's average. */
  age?: { label: string; slow?: boolean; done?: boolean };
  /** The key of the issue blocking this one: a thin red edge and a small chip. */
  blockedBy?: string;
  /** A linked doc's short name ("RFC", "Spec") in the accent with a doc icon. */
  doc?: string;
  subtasks?: { done: number; total: number };
  /** Open in the peek: the accent ring. */
  selected?: boolean;
  /** Part of a multi-selection: the accent tint and ring. */
  checked?: boolean;
  /**
   * An edit to it is on its way to the server: it dims after a beat, so an answer that comes
   * quickly shows nothing, and comes back the moment the answer lands.
   */
  pending?: boolean;
  /** A 3px left border from a colour rule; see cardStripe. */
  stripeClassName?: string;
  /**
   * Hover tools in the top-right corner (assign, open in peek, more). They show on hover and
   * whenever focus is inside the card, so the keyboard reaches them too.
   */
  tools?: ReactNode;
  /** Answers the pointer with the lifted shadow; on by default when the card selects itself. */
  interactive?: boolean;
  onSelect?: () => void;
  className?: string;
}

/**
 * The one issue card (docs/design/premium/kit.css, `.card`): the title first, labels as outlined
 * pills, then the type tile and the key in mono, with priority, points and the assignee on the
 * right. Blocked is a 2.5px red edge and a small chip, so the eye lands on the work first.
 */
export function IssueCard({
  issueKey,
  title,
  type,
  priority,
  assignee,
  labels,
  estimate,
  age,
  blockedBy,
  doc,
  subtasks,
  selected = false,
  checked = false,
  pending = false,
  stripeClassName,
  tools,
  onSelect,
  interactive = onSelect !== undefined,
  className,
}: IssueCardProps) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.();
    }
  };
  return (
    <div
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      aria-busy={pending || undefined}
      onClick={onSelect}
      onKeyDown={onSelect ? onKeyDown : undefined}
      className={cx(
        'group/card relative flex flex-col gap-2 rounded-card bg-card px-2.75 pt-2.5 pb-2.25 text-13 text-tx',
        'motion-safe:transition-[box-shadow,background-color,opacity]',
        checked ? 'bg-acc-50 shadow-e1 ring-1 ring-acc-100' : 'shadow-e1',
        pending && 'opacity-60 motion-safe:delay-(--duration-base)',
        selected && 'ring-2 ring-acc',
        interactive && 'hover:shadow-e1h',
        stripeClassName && cx('border-l-[3px]', stripeClassName),
        onSelect && cx('cursor-pointer', focusRing),
        className,
      )}
    >
      {blockedBy && (
        <span
          aria-hidden
          className="absolute top-2.25 bottom-2.25 left-0 w-[2.5px] rounded-r-[2px] bg-red"
        />
      )}
      {tools && (
        <div
          className={cx(
            'absolute top-1.5 right-1.5 z-1 flex gap-0.5 rounded-panel bg-card p-0.5 text-tx-2 shadow-e1',
            'opacity-0 group-focus-within/card:opacity-100 group-hover/card:opacity-100 has-[[aria-expanded=true]]:opacity-100',
            'motion-safe:transition-opacity pointer-coarse:opacity-100',
          )}
        >
          {tools}
        </div>
      )}
      {blockedBy && <BlockedChip by={blockedBy} />}
      <div className="leading-card font-medium text-pretty">{title}</div>
      {labels && labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {labels.map((label) => {
            const value = typeof label === 'string' ? { name: label } : label;
            return <Label key={value.name} {...value} />;
          })}
        </div>
      )}
      <div className="flex items-center gap-1.5 text-tx-3">
        <TypeGlyph type={type} />
        <span className="font-mono text-12 tracking-[-0.01em]">{issueKey}</span>
        {doc && (
          <span className="flex items-center gap-0.75 text-11 text-acc">
            <Icon name="doc" size={11} />
            {doc}
          </span>
        )}
        {subtasks && (
          <span
            aria-label={`${subtasks.done} of ${subtasks.total} subtasks done`}
            className="flex items-center gap-0.75 text-11 tabular-nums"
          >
            <Icon name="subtasks" size={11} />
            {subtasks.done}/{subtasks.total}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <PriorityGlyph priority={priority} />
          {estimate !== undefined && <Points value={estimate} />}
          {age && (
            <span
              title="Time in column"
              className={cx(
                'text-11 font-medium tabular-nums',
                age.slow ? 'text-amber-tx' : 'text-tx-3',
              )}
            >
              {age.done ? <Icon name="check" size={12} label={age.label} /> : age.label}
            </span>
          )}
          {assignee !== undefined && <IssueAssignee person={assignee} />}
        </span>
      </div>
    </div>
  );
}

export type { CardPerson };
