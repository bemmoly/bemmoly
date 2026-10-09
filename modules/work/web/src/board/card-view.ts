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
  type IssueType,
  type KanbanCardProps,
  type Priority,
} from '@bemmoly/ui';
import type { ViewCard } from '../hooks/board-model.ts';

/*
 * From a view card to what the design system's card draws, under the board's card fields and
 * colour rule. The names come from the vocabularies the board loaded once.
 */

/** Lane colours in order, from the Board mock's epics (accent, then violet); grey for none. */
const LANE_FILLS = ['bg-ac', 'bg-violet', 'bg-ok', 'bg-caution', 'bg-warn', 'bg-danger-hi'];
const LANE_STRIPES = [
  'border-l-ac',
  'border-l-violet',
  'border-l-ok',
  'border-l-caution',
  'border-l-warn',
  'border-l-danger-hi',
];

export const laneFill = (hue: number | null) =>
  hue === null ? 'bg-tx6' : (LANE_FILLS[hue % LANE_FILLS.length] ?? 'bg-ac');

const laneStripe = (hue: number | null) =>
  hue === null ? 'border-l-tx6' : LANE_STRIPES[hue % LANE_STRIPES.length];

const GLYPHS: ReadonlySet<string> = new Set([
  'story',
  'bug',
  'task',
  'epic',
  'incident',
  'subtask',
]);
const PRIORITIES: ReadonlySet<string> = new Set(['highest', 'high', 'medium', 'low', 'lowest']);

export interface CardVocabulary {
  types: ReadonlyMap<string, Pick<WorkIssueType, 'key' | 'name' | 'level'>>;
  people: ReadonlyMap<string, Pick<User, 'id' | 'name'>>;
  labels: ReadonlyMap<string, string>;
  meId: string | undefined;
  fields: readonly CardField[];
  colorRule: CardColorRule;
  /** Scrum cards show points; Kanban cards show the time in the column instead. */
  kanban: boolean;
  /** A card in a done column shows a tick for its age on Kanban. */
  doneColumns: ReadonlySet<string>;
}

export function glyphOf(vocab: CardVocabulary, typeId: string): IssueType {
  const type = vocab.types.get(typeId);
  if (type && GLYPHS.has(type.key)) return type.key as IssueType;
  if (type?.level === 'epic' || type?.level === 'subtask') return type.level;
  return 'task';
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
    .filter((name): name is string => Boolean(name));
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
            ? { label: '✓' }
            : { label: `${card.ageDays}d`, slow: card.ageDays >= SLOW_DAYS },
        }
      : {}),
    ...(show('blocked') && card.blockedBy[0] ? { blockedBy: card.blockedBy[0] } : {}),
    ...(show('docs') && card.docs[0] ? { doc: card.docs[0] } : {}),
    ...(show('subtasks') && card.subtasks ? { subtasks: card.subtasks } : {}),
    stripeClassName: cardStripe(vocab.colorRule, {
      priority,
      type,
      epicClassName: laneStripe(laneHue),
    }),
  };
}
