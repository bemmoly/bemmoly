import { Fragment, type ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { Avatar } from '../avatar/avatar.tsx';
import { PriorityGlyph, TypeGlyph, type IssueTypeRef, type Priority } from '../glyphs/glyphs.tsx';
import { IssueAssignee, Points, type CardPerson } from './issue-atoms.tsx';

/*
 * The card's footer row: what identifies the issue on the left (type, key, linked doc, subtasks,
 * dates), what sizes and owns it on the right (priority, points, time in column, people). Each
 * side draws its parts in the order the board lists them.
 */

/** The parts of the footer a board can show, hide and order. */
export const ISSUE_CARD_PARTS = [
  'type',
  'key',
  'docs',
  'subtasks',
  'due',
  'created',
  'priority',
  'estimate',
  'age',
  'reporter',
  'assignee',
] as const;

export type IssueCardPart = (typeof ISSUE_CARD_PARTS)[number];

const RIGHT: ReadonlySet<IssueCardPart> = new Set([
  'priority',
  'estimate',
  'age',
  'reporter',
  'assignee',
]);

export interface IssueCardFooterProps {
  issueKey: string;
  type: IssueTypeRef;
  showType: boolean;
  showKey: boolean;
  priority?: Priority | undefined;
  assignee?: CardPerson | null | undefined;
  coAssignees?: readonly CardPerson[] | undefined;
  estimate?: number | string | undefined;
  age?: { label: string; slow?: boolean; done?: boolean } | undefined;
  doc?: string | undefined;
  subtasks?: { done: number; total: number } | undefined;
  due?: { label: string; overdue?: boolean } | undefined;
  created?: string | undefined;
  reporter?: CardPerson | undefined;
  order?: readonly IssueCardPart[] | undefined;
}

/** The parts in the board's order; parts it does not list keep their default place after. */
function ordered(order: readonly IssueCardPart[] | undefined): IssueCardPart[] {
  if (!order) return [...ISSUE_CARD_PARTS];
  return [...order, ...ISSUE_CARD_PARTS.filter((part) => !order.includes(part))];
}

export function IssueCardFooter(props: IssueCardFooterProps) {
  const { issueKey, type, priority, assignee, estimate, age, doc, subtasks } = props;
  const { due, created, reporter } = props;
  const parts: Record<IssueCardPart, ReactNode> = {
    type: props.showType && <TypeGlyph type={type} />,
    key: props.showKey && (
      <span className="shrink-0 font-mono text-12 tracking-[-0.01em] whitespace-nowrap">
        {issueKey}
      </span>
    ),
    docs: doc && (
      <span className="flex min-w-0 items-center gap-0.75 text-11 text-acc">
        <Icon name="doc" size={11} />
        <span className="truncate">{doc}</span>
      </span>
    ),
    subtasks: subtasks && (
      <span
        aria-label={`${subtasks.done} of ${subtasks.total} subtasks done`}
        className="flex items-center gap-0.75 text-11 tabular-nums"
      >
        <Icon name="subtasks" size={11} />
        {subtasks.done}/{subtasks.total}
      </span>
    ),
    due: due && (
      <span
        title={due.overdue ? 'Overdue' : 'Due date'}
        aria-label={`Due ${due.label}${due.overdue ? ', overdue' : ''}`}
        className={cx(
          'flex shrink-0 items-center gap-0.75 text-11 font-medium whitespace-nowrap tabular-nums',
          due.overdue && 'text-red-tx',
        )}
      >
        <Icon name="calendar" size={11} />
        {due.label}
      </span>
    ),
    created: created && (
      <span
        title="Created"
        aria-label={`Created ${created}`}
        className="shrink-0 text-11 whitespace-nowrap tabular-nums"
      >
        {created}
      </span>
    ),
    priority: priority && <PriorityGlyph priority={priority} />,
    estimate: estimate !== undefined && <Points value={estimate} />,
    age: age && (
      <span
        title="Time in column"
        className={cx('text-11 font-medium tabular-nums', age.slow ? 'text-amber-tx' : 'text-tx-3')}
      >
        {age.done ? <Icon name="check" size={12} label={age.label} /> : age.label}
      </span>
    ),
    reporter: reporter && (
      <Avatar
        name={reporter.name}
        aria-label={`Reported by ${reporter.name}`}
        title={`Reported by ${reporter.name}`}
        size={16}
        {...(reporter.hue ? { hue: reporter.hue } : {})}
        {...(reporter.initials ? { initials: reporter.initials } : {})}
      />
    ),
    assignee: assignee !== undefined && (
      <IssueAssignee person={assignee} others={props.coAssignees} />
    ),
  };
  const all = ordered(props.order);
  const side = (right: boolean) =>
    all
      .filter((part) => RIGHT.has(part) === right && parts[part])
      .map((part) => <Fragment key={part}>{parts[part]}</Fragment>);
  return (
    // A narrow column with many parts wraps the right side under the left instead of spilling.
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-tx-3">
      {side(false)}
      <span className="ml-auto flex items-center gap-1.5">{side(true)}</span>
    </div>
  );
}
