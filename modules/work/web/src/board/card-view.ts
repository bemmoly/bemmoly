import type {
  CardColorRule,
  CardField,
  IssueType as WorkIssueType,
} from '@bemmoly/module-work/shared';
import type { User } from '@bemmoly/shared';
import {
  avatarHue,
  cardStripe,
  epicStripe,
  ISSUE_CARD_PARTS,
  type CardPerson,
  type EpicColor,
  type IssueCardPart,
  type IssueCardProps,
  type IssueTypeRef,
  type LabelValue,
  type Priority,
} from '@bemmoly/ui';
import type { ViewCard } from '../hooks/board-model.ts';

/*
 * From a view card to what the design system's card draws, under the board's card fields and
 * colour rule, the same for everyone: a field the board lists shows whenever the issue has a
 * value for it, in the board's order, and a field it does not list never shows. The names come
 * from the vocabularies the board loaded once.
 */

/** A colour rule's stripe reads the card's --card-rule, set from the rule's colour. */
export const RULE_STRIPE = 'border-l-(--card-rule)';

const PRIORITIES: ReadonlySet<string> = new Set(['highest', 'high', 'medium', 'low', 'lowest']);

export interface CardVocabulary {
  types: ReadonlyMap<string, Pick<WorkIssueType, 'key' | 'name' | 'level'>>;
  people: ReadonlyMap<string, Pick<User, 'id' | 'name'>>;
  labels: ReadonlyMap<string, LabelValue>;
  meId: string | undefined;
  /** The fields the cards draw: the board's card fields, set by admins in Board settings. */
  shown: ReadonlySet<CardField>;
  /** The footer's order, from the board's card fields. */
  order: readonly IssueCardPart[];
  colorRule: CardColorRule;
  /** A card in a done column shows a tick for its time in column, and is never overdue. */
  doneColumns: ReadonlySet<string>;
  /** Today in the viewer's calendar, "2026-10-11": what a due date is overdue against. */
  today: string;
  /** Each epic's stored colour by id, for the "by epic" stripe when lanes are not epics. */
  epicColors: ReadonlyMap<string, EpicColor>;
  /** The colour of the first colour rule the card matches, painted as its stripe. */
  ruleColor: (card: ViewCard) => string | null;
}

/** The card's type as stored, so a custom type draws its own icon and colour. */
export function glyphOf(vocab: CardVocabulary, typeId: string): IssueTypeRef {
  return vocab.types.get(typeId) ?? 'task';
}

export function personOf(vocab: CardVocabulary, userId: string | null): CardPerson | undefined {
  if (!userId) return undefined;
  const user = vocab.people.get(userId);
  const name = user?.name ?? 'Someone';
  return { name, hue: userId === vocab.meId ? 'accent' : avatarHue(userId) };
}

/** The card's priority as the design system knows it; an unknown level reads as medium. */
export function cardPriority(card: ViewCard): Priority {
  return (PRIORITIES.has(card.priority) ? card.priority : 'medium') as Priority;
}

/** Days in the column at which the mock marks a card slow (its age rule is four or more). */
const SLOW_DAYS = 4;

/** The card's order of its footer parts: the board's fields that the footer draws. */
export function footerOrder(fields: readonly CardField[]): IssueCardPart[] {
  return fields.filter((field): field is IssueCardPart & CardField =>
    (ISSUE_CARD_PARTS as readonly string[]).includes(field),
  );
}

/** Today as a calendar day in the viewer's time zone. */
export function localDay(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "Oct 6" for a day this year, "Oct 6, 2025" for any other. */
export function cardDay(iso: string, today: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return date.toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    ...(iso.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
  });
}

export function cardProps(
  card: ViewCard,
  vocab: CardVocabulary,
  laneColor: EpicColor | null,
): Omit<IssueCardProps, 'selected' | 'checked' | 'onSelect' | 'className' | 'tools'> {
  const show = (field: CardField) => vocab.shown.has(field);
  const priority = cardPriority(card);
  const type = glyphOf(vocab, card.typeId);
  const labels = card.labelIds
    .map((id) => vocab.labels.get(id))
    .filter((label): label is LabelValue => Boolean(label));
  const done = vocab.doneColumns.has(card.columnId);
  const assignee = personOf(vocab, card.assigneeId);
  const reporter = personOf(vocab, card.reporterId);
  const coAssignees = (card.assigneeIds ?? [])
    .filter((id) => id !== card.assigneeId)
    .map((id) => personOf(vocab, id))
    .filter((person): person is CardPerson => Boolean(person));
  return {
    issueKey: card.key,
    showKey: show('key'),
    title: card.title,
    type,
    showType: show('type'),
    order: vocab.order,
    ...(show('priority') ? { priority } : {}),
    // On, an unassigned card draws the empty ring: the field is there, nobody holds it yet.
    ...(show('assignee') ? { assignee: assignee ?? null } : {}),
    ...(show('assignee') && assignee && coAssignees.length > 0 ? { coAssignees } : {}),
    ...(show('labels') && labels.length > 0 ? { labels } : {}),
    ...(show('estimate') && card.estimate !== null ? { estimate: card.estimate } : {}),
    ...(show('age')
      ? {
          age: done
            ? { label: 'Done', done: true }
            : { label: `${card.ageDays}d`, slow: card.ageDays >= SLOW_DAYS },
        }
      : {}),
    ...(show('blocked') && card.blockedBy[0] ? { blockedBy: card.blockedBy[0] } : {}),
    ...(show('docs') && card.docs[0] ? { doc: card.docs[0] } : {}),
    ...(show('subtasks') && card.subtasks ? { subtasks: card.subtasks } : {}),
    ...(show('due') && card.dueAt
      ? {
          due: {
            label: cardDay(card.dueAt, vocab.today),
            overdue: !done && card.dueAt < vocab.today,
          },
        }
      : {}),
    ...(show('created') && card.createdAt ? { created: cardDay(card.createdAt, vocab.today) } : {}),
    ...(show('reporter') && reporter ? { reporter } : {}),
    stripeClassName: vocab.ruleColor(card)
      ? RULE_STRIPE
      : cardStripe(vocab.colorRule, {
          priority,
          type,
          epicClassName: epicStripe(
            (card.epicId ? vocab.epicColors.get(card.epicId) : undefined) ?? laneColor,
          ),
        }),
  };
}
