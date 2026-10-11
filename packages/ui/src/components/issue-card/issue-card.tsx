import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import type { IssueTypeRef, Priority } from '../glyphs/glyphs.tsx';
import { Label, type LabelValue } from '../label/label.tsx';
import { BlockedChip, type CardPerson } from './issue-atoms.tsx';
import { IssueCardFooter, type IssueCardPart } from './issue-card-footer.tsx';

export interface IssueCardProps {
  issueKey: string;
  /** Prints the key beside the type; off, the key still names the card to assistive tech. */
  showKey?: boolean;
  title: ReactNode;
  type: IssueTypeRef;
  /** Draws the type tile; off, the card still uses the type for a "by type" stripe. */
  showType?: boolean;
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
  /** The due date as the board prints it ("Oct 6"), red once it has passed. */
  due?: { label: string; overdue?: boolean };
  /** The day the issue was created, as the board prints it. */
  created?: string;
  /** Who reported it: a smaller avatar before the assignee's. */
  reporter?: CardPerson;
  /** The footer parts in the board's order; each side of the footer keeps to it. */
  order?: readonly IssueCardPart[];
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
   * Shows the round selection mark on the top-left corner on hover and keyboard focus (always
   * while anything is checked, and always on touch). It gets the click, so the handler can
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

/**
 * Hover tools and the selection box: on hover, on focus inside the card or on its wrapper. A
 * screen may draw them only once the card is first reached; they still fade in then.
 */
const REVEAL =
  'opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 in-focus-visible:opacity-100 starting:opacity-0';

interface SelectBoxProps {
  issueKey: string;
  checked: boolean;
  visible: boolean;
  onCheck: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * The selection mark: a round check sitting on the card's top-left corner, so showing it never
 * moves or covers the card's contents, and so a ticked card never reads as the square task tile.
 * Its hit area reaches 34px (46px on touch) past the 18px mark. Touch has no hover, so there it
 * is always shown, and so it moves inside the card (which makes room for it) instead of hanging
 * off a corner that a phone's narrow column leaves no gutter for.
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
        'absolute -top-2 -left-2 z-2 grid pointer-coarse:top-2.75 pointer-coarse:left-2.25 size-4.5 cursor-pointer place-items-center rounded-full border-[1.5px] p-0 shadow-e1',
        'before:absolute before:-inset-2 before:rounded-full pointer-coarse:before:-inset-3.5',
        checked
          ? 'border-acc-fill bg-acc-fill text-on-acc'
          : 'border-tx-3 bg-card text-transparent hover:text-tx-3',
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
 * right. Blocked is a 2.5px red edge and a small chip, so the eye lands on the work first. Every
 * part but the title is optional, so a board's card fields decide exactly what shows.
 */
export function IssueCard({
  issueKey,
  showKey = true,
  title,
  type,
  showType = true,
  priority,
  assignee,
  labels,
  estimate,
  age,
  blockedBy,
  doc,
  subtasks,
  due,
  created,
  reporter,
  order,
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
        onCheck && 'pointer-coarse:pl-8.5',
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
            'absolute top-1.5 right-1.5 z-1 flex gap-0.5 rounded-control bg-card p-0.5 text-tx-2 shadow-e1',
            REVEAL,
            'has-[[aria-expanded=true]]:opacity-100',
            'motion-safe:transition-opacity pointer-coarse:opacity-100',
          )}
        >
          {tools}
        </div>
      )}
      {onCheck && (
        <SelectBox
          issueKey={issueKey}
          checked={checked}
          visible={checked || selecting}
          onCheck={onCheck}
        />
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
      <IssueCardFooter
        issueKey={issueKey}
        type={type}
        showType={showType}
        showKey={showKey}
        priority={priority}
        assignee={assignee}
        estimate={estimate}
        age={age}
        doc={doc}
        subtasks={subtasks}
        due={due}
        created={created}
        reporter={reporter}
        order={order}
      />
    </div>
  );
}

export type { CardPerson };
