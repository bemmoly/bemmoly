import type { KeyboardEvent, ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { Avatar, type AvatarHue } from '../avatar/avatar.tsx';
import { Badge } from '../badge/badge.tsx';
import { PriorityGlyph, TypeGlyph, type IssueTypeRef, type Priority } from '../glyphs/glyphs.tsx';
import { KeyChip } from '../key-chip/key-chip.tsx';
import { Tag } from '../tag/tag.tsx';

export interface CardPerson {
  name: string;
  initials?: string;
  hue?: AvatarHue;
}

export interface KanbanCardProps {
  issueKey: string;
  title: ReactNode;
  type: IssueTypeRef;
  priority: Priority;
  assignee?: CardPerson;
  labels?: readonly string[];
  /** Story points (Scrum) in the mono chip pill; omit on Kanban boards. */
  estimate?: number | string;
  /** Time in column (Kanban): the label and whether it is past the column's average. */
  age?: { label: string; slow?: boolean };
  /** The key of the issue blocking this one; shows the warn badge above the title. */
  blockedBy?: string;
  /** A linked doc's short name ("RFC", "Spec") in the accent with a doc icon. */
  doc?: string;
  subtasks?: { done: number; total: number };
  selected?: boolean;
  /** Filtered out by a quick filter: the mock fades the card to 28%. */
  dimmed?: boolean;
  /** A 3px left border from a colour rule; see cardStripe. */
  stripeClassName?: string;
  /**
   * Answers the pointer: a stronger border and a lifted shadow on hover. On by default when the
   * card selects itself; the Board's wrapper, which handles the click and the drag, turns it on.
   */
  interactive?: boolean;
  onSelect?: () => void;
  className?: string;
}

/**
 * The Board card: 10px 10px 8px on the surface with a 6px radius and the card shadow; selected
 * swaps the border for the accent and the 2px ring. Blocks are 8px apart and the footer sits
 * 2px lower.
 */
export function KanbanCard({
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
  dimmed = false,
  stripeClassName,
  onSelect,
  interactive = onSelect !== undefined,
  className,
}: KanbanCardProps) {
  const onKeyDown = (event: KeyboardEvent) => {
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
      onClick={onSelect}
      onKeyDown={onSelect ? onKeyDown : undefined}
      className={cx(
        'flex flex-col gap-2 rounded-control border bg-sf px-2.5 pt-2.5 pb-2 text-13 text-tx',
        'motion-safe:transition-[border-color,box-shadow,opacity]',
        selected ? 'border-ac shadow-ring' : 'border-br shadow-card',
        interactive && !selected && cx('hover:shadow-pop', !stripeClassName && 'hover:border-br3'),
        stripeClassName && cx('border-l-[3px]', stripeClassName),
        onSelect && cx('cursor-pointer', focusRing),
        dimmed && 'opacity-28',
        className,
      )}
    >
      {blockedBy && (
        <span className="flex items-center gap-1.5 self-start rounded-xs bg-warn-bg px-1.75 py-0.75 text-11 font-medium text-warn-fg">
          <span aria-hidden className="size-1.75 rounded-full bg-warn" />
          Blocked by {blockedBy}
        </span>
      )}
      <div className="leading-card text-pretty">{title}</div>
      {labels && labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {labels.map((label) => (
            <Tag key={label}>{label}</Tag>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5 pt-0.5">
        <TypeGlyph type={type} />
        <KeyChip issueKey={issueKey} />
        <PriorityGlyph priority={priority} />
        {doc && (
          <span className="flex items-center gap-0.75 text-11 text-ac">
            <Icon name="doc" size={11} />
            {doc}
          </span>
        )}
        {subtasks && (
          <span
            aria-label={`${subtasks.done} of ${subtasks.total} subtasks done`}
            className="flex items-center gap-0.75 font-mono text-11 text-tx4"
          >
            <Icon name="subtasks" size={11} />
            {subtasks.done}/{subtasks.total}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {estimate !== undefined && (
            <Badge variant="count" className="min-w-5 justify-center">
              {estimate}
            </Badge>
          )}
          {age && (
            <span
              title="Time in column"
              className={cx(
                'font-mono text-11 font-medium',
                age.slow ? 'text-warn-fg' : 'text-tx5',
              )}
            >
              {age.label}
            </span>
          )}
          {assignee && (
            <Avatar
              name={assignee.name}
              hue={assignee.hue}
              {...(assignee.initials ? { initials: assignee.initials } : {})}
            />
          )}
        </span>
      </div>
    </div>
  );
}
