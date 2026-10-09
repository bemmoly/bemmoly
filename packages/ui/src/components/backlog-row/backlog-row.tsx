import type { KeyboardEvent, ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRingInset } from '../../lib/focus.ts';
import { Avatar, type AvatarHue } from '../avatar/avatar.tsx';
import { Badge } from '../badge/badge.tsx';
import { PriorityGlyph, TypeGlyph, type IssueType, type Priority } from '../glyphs/glyphs.tsx';
import { KeyChip } from '../key-chip/key-chip.tsx';
import { StatusBadge, type StatusCategory } from '../status-badge/status-badge.tsx';

export interface BacklogRowProps {
  issueKey: string;
  title: ReactNode;
  type: IssueType;
  priority: Priority;
  status: { category: StatusCategory; label?: ReactNode };
  /** The epic's name and colour square (a background utility such as bg-ac). */
  epic?: { name: ReactNode; colorClassName: string };
  assignee?: { name: string; initials?: string; hue?: AvatarHue };
  estimate?: number | string;
  /** A linked doc's short name, in the accent with ↗. */
  doc?: string;
  selected?: boolean;
  onSelect?: () => void;
  /** Drag handle props from the drag library; the grip is always drawn. */
  dragHandleProps?: Record<string, unknown>;
  className?: string;
}

/** The Backlog mock's row tracks: grip, type, key, title, epic, status, priority, points, avatar. */
export const BACKLOG_ROW_TEMPLATE = '16px 20px 84px minmax(0,1fr) 110px 120px 60px 40px 28px';

/**
 * One issue in a sprint or the backlog: a 9-track grid 10px apart, 8px 14px padding, divided by
 * br-row; the selected row sits on the accent tint.
 */
export function BacklogRow({
  issueKey,
  title,
  type,
  priority,
  status,
  epic,
  assignee,
  estimate,
  doc,
  selected = false,
  onSelect,
  dragHandleProps,
  className,
}: BacklogRowProps) {
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
      style={{ gridTemplateColumns: BACKLOG_ROW_TEMPLATE }}
      className={cx(
        'grid items-center gap-2.5 border-b border-br-row px-3.5 py-2 text-13 text-tx',
        'motion-safe:transition-colors',
        selected ? 'bg-ac-bg' : 'bg-sf',
        onSelect && cx('cursor-pointer', !selected && 'hover:bg-bg2', focusRingInset),
        className,
      )}
    >
      <span aria-hidden className="cursor-grab text-tx6" {...dragHandleProps}>
        <Icon name="drag" size={14} />
      </span>
      <TypeGlyph type={type} />
      <KeyChip issueKey={issueKey} />
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate" title={typeof title === 'string' ? title : undefined}>
          {title}
        </span>
        {doc && (
          <span className="flex shrink-0 items-center gap-0.5 text-11 text-ac">
            <Icon name="external" size={11} />
            {doc}
          </span>
        )}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-12 text-tx3">
        {epic && (
          <>
            <span aria-hidden className={cx('size-2 shrink-0 rounded-tick', epic.colorClassName)} />
            <span
              className="truncate"
              title={typeof epic.name === 'string' ? epic.name : undefined}
            >
              {epic.name}
            </span>
          </>
        )}
      </span>
      <StatusBadge category={status.category} label={status.label} className="justify-self-start" />
      <PriorityGlyph priority={priority} />
      <span className="flex">
        {estimate !== undefined && (
          <Badge variant="count" className="flex-1 justify-center">
            {estimate}
          </Badge>
        )}
      </span>
      <span className="flex">
        {assignee ? (
          <Avatar
            name={assignee.name}
            hue={assignee.hue}
            {...(assignee.initials ? { initials: assignee.initials } : {})}
          />
        ) : (
          <Avatar name="Unassigned" initials="?" hue="grey" />
        )}
      </span>
    </div>
  );
}

export interface BacklogCreateRowProps {
  onCreate: () => void;
  label?: ReactNode;
  className?: string;
}

/** The "+ Create issue" line under a container's rows: 9px 14px 9px 50px in tx5. */
export function BacklogCreateRow({
  onCreate,
  label = 'Create issue',
  className,
}: BacklogCreateRowProps) {
  return (
    <button
      type="button"
      onClick={onCreate}
      className={cx(
        'flex w-full cursor-pointer items-center gap-1 border-0 bg-transparent py-2.25 pr-3.5 pl-12.5 text-left font-sans text-12h text-tx5 hover:text-tx2',
        focusRingInset,
        className,
      )}
    >
      <Icon name="plus" size={12} />
      {label}
    </button>
  );
}
