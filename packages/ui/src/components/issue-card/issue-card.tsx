import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { PriorityGlyph, TypeGlyph, type IssueTypeRef, type Priority } from '../glyphs/glyphs.tsx';
import { Label, type LabelValue } from '../label/label.tsx';
import { BlockedChip, IssueAssignee, Points, type CardPerson } from './issue-atoms.tsx';

export interface IssueCardProps {
  issueKey: string;
  /** Prints the key beside the type; off, the key still names the card to assistive tech. */
  showKey?: boolean;
  title: ReactNode;
  type: IssueTypeRef;
  /** The priority bars; undefined leaves the slot out. */
  priority?: Priority;
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
  /** Part of a multi-selection: the accent tint and ring, and the box ticked. */
  checked?: boolean;
  /**
   * An edit to it is on its way to the server: it dims after a beat, so an answer that comes
   * quickly shows nothing, and comes back the moment the answer lands.
   */
  pending?: boolean;
  /**
   * Shows the selection box over the type tile on hover and keyboard focus (always while
   * anything is checked, and beside the tile on touch). It gets the click, so the handler can
   * read Shift and Cmd / Ctrl.
   */
  onCheck?: (event: MouseEvent<HTMLElement>) => void;
  /** Whether any card on the screen is checked; the boxes then stay visible. */
  selecting?: boolean;
  /** Compact tightens the padding and gaps and keeps the title to two lines. */
  density?: 'comfortable' | 'compact';
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

/** Hover tools and the selection box: on hover, on focus inside the card or on its wrapper. */
const REVEAL =
  'opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 in-focus-visible:opacity-100';

interface SelectBoxProps {
  issueKey: string;
  checked: boolean;
  visible: boolean;
  onCheck: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * The selection box, laid over the type tile so showing it never moves the card's contents. Its
 * hit area reaches 32px (44px on touch) past the 16px box. Touch has no hover, so there it sits
 * beside the tile, always shown.
 */
function SelectBox({ issueKey, checked, visible, onCheck }: SelectBoxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`Select ${issueKey}`}
      tabIndex={-1}
      draggable={false}
      onClick={(event) => {
        event.stopPropagation();
        onCheck(event);
      }}
      onMouseDown={(event) => {
        // Shift-click would otherwise select the text between this card and the last one.
        if (event.shiftKey) event.preventDefault();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      className={cx(
        'absolute -top-px -left-px z-1 grid size-4 cursor-pointer place-items-center rounded-xs border-[1.5px] p-0',
        'before:absolute before:-inset-2 pointer-coarse:relative pointer-coarse:top-0 pointer-coarse:left-0 pointer-coarse:before:-inset-3.5',
        checked
          ? 'border-acc-fill bg-acc-fill text-on-acc'
          : 'border-tx-3 bg-card text-transparent',
        !visible && cx(REVEAL, 'pointer-coarse:opacity-100'),
        'motion-safe:transition-opacity',
        focusRing,
      )}
    >
      <Icon name="check" size={10} />
    </button>
  );
}

/**
 * The one issue card (docs/design/premium/kit.css, `.card`): the title first, labels as outlined
 * pills, then the type tile and the key in mono, with priority, points and the assignee on the
 * right. Blocked is a 2.5px red edge and a small chip, so the eye lands on the work first.
 */
export function IssueCard({
  issueKey,
  showKey = true,
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
  onCheck,
  selecting = false,
  density = 'comfortable',
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
        'group/card relative flex flex-col rounded-card text-13 text-tx',
        density === 'compact' ? 'gap-1.25 px-2.5 py-1.75' : 'gap-2 px-2.75 pt-2.5 pb-2.25',
        'motion-safe:transition-[box-shadow,background-color,opacity]',
        checked ? 'bg-acc-50 shadow-e1 ring-1 ring-acc-100' : 'bg-card shadow-e1',
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
            REVEAL,
            'has-[[aria-expanded=true]]:opacity-100',
            'motion-safe:transition-opacity pointer-coarse:opacity-100',
          )}
        >
          {tools}
        </div>
      )}
      {blockedBy && <BlockedChip by={blockedBy} />}
      <div
        className={cx(
          'leading-card font-medium text-pretty',
          density === 'compact' && 'line-clamp-2',
        )}
      >
        {title}
      </div>
      {labels && labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {labels.map((label) => {
            const value = typeof label === 'string' ? { name: label } : label;
            return <Label key={value.name} {...value} />;
          })}
        </div>
      )}
      <div className="flex items-center gap-1.5 text-tx-3">
        <span className="relative flex shrink-0 items-center gap-1.5">
          {onCheck && (
            <SelectBox
              issueKey={issueKey}
              checked={checked}
              visible={checked || selecting}
              onCheck={onCheck}
            />
          )}
          <TypeGlyph type={type} />
        </span>
        {showKey && <span className="font-mono text-12 tracking-[-0.01em]">{issueKey}</span>}
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
          {priority && <PriorityGlyph priority={priority} />}
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
