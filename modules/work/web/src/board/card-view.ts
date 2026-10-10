import type {
  CardField,
  CardColorRule,
  IssueType as WorkIssueType,
} from '@bemmoly/module-work/shared';
import type { User } from '@bemmoly/shared';
import {
  avatarHue,
  cardStripe,
  type CardPerson,
  type IssueTypeRef,
  type KanbanCardProps,
  type LabelValue,
  type Priority,
} from '@bemmoly/ui';
import type { ViewCard } from '../hooks/board-model.ts';

/*
 * From a view card to what the design system's card draws, under the board's card fields and
 * colour rule. The names come from the vocabularies the board loaded once.
 */

/** Lane colours in order, from the epic palette; muted grey for no epic. */
const LANE_FILLS = [
  'bg-epic-1',
  'bg-epic-2',
  'bg-epic-3',
  'bg-epic-4',
  'bg-epic-5',
  'bg-epic-6',
  'bg-epic-7',
  'bg-epic-8',
];
const LANE_STRIPES = [
  'border-l-epic-1',
  'border-l-epic-2',
  'border-l-epic-3',
  'border-l-epic-4',
  'border-l-epic-5',
  'border-l-epic-6',
  'border-l-epic-7',
  'border-l-epic-8',
];

export const laneFill = (hue: number | null) =>
  hue === null ? 'bg-tx-3' : (LANE_FILLS[hue % LANE_FILLS.length] ?? 'bg-epic-1');

const laneStripe = (hue: number | null) =>
  hue === null ? 'border-l-tx-3' : LANE_STRIPES[hue % LANE_STRIPES.length];

/** A colour rule's stripe reads the card's --card-rule, set from the rule's colour. */
export const RULE_STRIPE = 'border-l-(--card-rule)';

const PRIORITIES: ReadonlySet<string> = new Set(['highest', 'high', 'medium', 'low', 'lowest']);

export interface CardVocabulary {
  types: ReadonlyMap<string, Pick<WorkIssueType, 'key' | 'name' | 'level'>>;
  people: ReadonlyMap<string, Pick<User, 'id' | 'name'>>;
  labels: ReadonlyMap<string, LabelValue>;
  meId: string | undefined;
  fields: readonly CardField[];
  colorRule: CardColorRule;
  /** Scrum cards show points; Kanban cards show the time in the column instead. */
  kanban: boolean;
  /** A card in a done column shows a tick for its age on Kanban. */
  doneColumns: ReadonlySet<string>;
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

/** Days in the column at which the mock marks a card slow (its age rule is four or more). */
const SLOW_DAYS = 4;

export function cardProps(
  card: ViewCard,
  vocab: CardVocabulary,
  laneHue: number | null,
): Omit<KanbanCardProps, 'selected' | 'dimmed' | 'onSelect' | 'className'> {
  const show = (field: CardField) => vocab.fields.includes(field);
  const priority = (PRIORITIES.has(card.priority) ? card.priority : 'medium') as Priority;
  const type = glyphOf(vocab, card.typeId);
  const labels = card.labelIds
    .map((id) => vocab.labels.get(id))
    .filter((label): label is LabelValue => Boolean(label));
  const done = vocab.doneColumns.has(card.columnId);
  return {
    issueKey: card.key,
    title: card.title,
    type,
    priority,
    ...(show('assignee') ? { assignee: personOf(vocab, card.assigneeId) } : {}),
    ...(show('labels') && labels.length > 0 ? { labels } : {}),
    ...(!vocab.kanban && show('estimate') && card.estimate !== null
      ? { estimate: card.estimate }
      : {}),
    ...(vocab.kanban
      ? {
          age: done
            ? { label: 'Done', done: true }
            : { label: `${card.ageDays}d`, slow: card.ageDays >= SLOW_DAYS },
        }
      : {}),
    ...(show('blocked') && card.blockedBy[0] ? { blockedBy: card.blockedBy[0] } : {}),
    ...(show('docs') && card.docs[0] ? { doc: card.docs[0] } : {}),
    ...(show('subtasks') && card.subtasks ? { subtasks: card.subtasks } : {}),
    stripeClassName: vocab.ruleColor(card)
      ? RULE_STRIPE
      : cardStripe(vocab.colorRule, {
          priority,
          type,
          epicClassName: laneStripe(laneHue),
        }),
  };
}
