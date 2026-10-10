import type { MouseEvent, ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing, focusRingInset } from '../../lib/focus.ts';
import {
  PriorityGlyph,
  StatusGlyph,
  TypeGlyph,
  type IssueTypeRef,
  type Priority,
  type StatusStage,
} from '../glyphs/glyphs.tsx';
import { epicFill, type EpicColor } from '../issue-card/epic-color.ts';
import { IssueAssignee, Points, type CardPerson } from '../issue-card/issue-atoms.tsx';
import { Label, type LabelValue } from '../label/label.tsx';

export interface IssueRowProps {
  issueKey: string;
  title: ReactNode;
  type: IssueTypeRef;
  priority: Priority;
  status: { stage: StatusStage; label?: string };
  /** The epic's name and stored colour; drawn only where the list is not grouped by epic. */
  epic?: { name: string; color: EpicColor | null };
  /** Names, or stored labels with their colour. */
  labels?: readonly (string | LabelValue)[];
  /** The assignee; null or undefined draws the unassigned ring. */
  assignee?: CardPerson | null;
  estimate?: number | string;
  /** The key of the issue blocking this one: a red lock after the title. */
  blockedBy?: string;
  /** Open in the peek: the accent tint. */
  selected?: boolean;
  /** Part of a multi-selection: the box is ticked and the row tinted. */
  checked?: boolean;
  /**
   * Shows the selection box on hover and focus (always while anything is checked). It gets
   * the click, so the handler can read Shift and ⌘ / Ctrl.
   */
  onCheck?: (event: MouseEvent<HTMLElement>) => void;
  /** Whether any row in the list is checked; the boxes then stay visible. */
  selecting?: boolean;
  /** Drag handle props; the grip shows on hover and focus. */
  dragHandleProps?: Record<string, unknown>;
  className?: string;
}

/** The tracks: select, type, key, title, epic, status, priority, points, avatar. */
export const issueRowTemplate = (epic: boolean) =>
  `16px 16px 64px minmax(0,1fr) ${epic ? '120px ' : ''}16px 16px 22px 20px`;

/**
 * The one issue row (docs/design/premium/kit.css, `.lrow`): 36px tall, divided by the lighter
 * line, with the same fields in the same order as the card. Secondary parts (the grip, the
 * selection box) appear on hover and keyboard focus and stay while a selection is in progress.
 */
export function IssueRow({
  issueKey,
  title,
  type,
  priority,
  status,
  epic,
  labels,
  assignee,
  estimate,
  blockedBy,
  selected = false,
  checked = false,
  onCheck,
  selecting = false,
  dragHandleProps,
  className,
}: IssueRowProps) {
  const reveal = 'opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100';
  return (
    <div
      style={{ gridTemplateColumns: issueRowTemplate(epic !== undefined) }}
      className={cx(
        'group/row relative grid h-9 items-center gap-2.5 border-b border-line-2 pr-6 pl-4 text-13 text-tx',
        'motion-safe:transition-colors',
        checked || selected ? 'bg-acc-50' : 'hover:bg-hover',
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          'absolute top-1/2 left-0.5 -translate-y-1/2 cursor-grab text-tx-3 active:cursor-grabbing',
          reveal,
        )}
        {...dragHandleProps}
      >
        <Icon name="drag" size={12} />
      </span>
      <span className="flex">
        {onCheck && (
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={`Select ${issueKey}`}
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
              onCheck(event);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className={cx(
              'grid size-4 cursor-pointer place-items-center rounded-xs border-[1.5px] p-0',
              checked
                ? 'border-acc-fill bg-acc-fill text-on-acc'
                : 'border-tx-3 bg-card text-transparent',
              !checked && !selecting && reveal,
              focusRing,
            )}
          >
            <Icon name="check" size={10} />
          </button>
        )}
      </span>
      <TypeGlyph type={type} />
      <span className="truncate font-mono text-12 tracking-[-0.01em] text-tx-3">{issueKey}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-[450]" title={typeof title === 'string' ? title : undefined}>
          {title}
        </span>
        {blockedBy && (
          <span className="shrink-0 text-red">
            <Icon name="lock" size={12} label={`Blocked by ${blockedBy}`} />
          </span>
        )}
        {labels && labels.length > 0 && (
          <span className="hidden shrink-0 items-center gap-1 lg:flex">
            {labels.slice(0, 3).map((label) => {
              const value = typeof label === 'string' ? { name: label } : label;
              return <Label key={value.name} {...value} />;
            })}
          </span>
        )}
      </span>
      {epic && (
        <span className="flex min-w-0 items-center gap-1.5 text-12 text-tx-2">
          <i aria-hidden className={cx('size-2 shrink-0 rounded-[2.5px]', epicFill(epic.color))} />
          <span className="truncate" title={epic.name}>
            {epic.name}
          </span>
        </span>
      )}
      <StatusGlyph stage={status.stage} {...(status.label ? { label: status.label } : {})} />
      <PriorityGlyph priority={priority} />
      <span className="flex justify-center">
        {estimate !== undefined && <Points value={estimate} />}
      </span>
      <IssueAssignee person={assignee} />
    </div>
  );
}

export interface IssueCreateRowProps {
  onCreate: () => void;
  label?: ReactNode;
  className?: string;
}

/** The "+ Create issue" line under a list's rows, in the muted ink. */
export function IssueCreateRow({
  onCreate,
  label = 'Create issue',
  className,
}: IssueCreateRowProps) {
  return (
    <button
      type="button"
      onClick={onCreate}
      className={cx(
        'flex h-9 w-full cursor-pointer items-center gap-2 border-0 border-b border-line-2 bg-transparent pr-6 pl-4 text-left font-sans text-13 text-tx-3 hover:bg-hover hover:text-tx-2',
        focusRingInset,
        className,
      )}
    >
      <Icon name="plus" size={14} />
      {label}
    </button>
  );
}
