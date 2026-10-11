import type { CardColorRule, IssueType as WorkIssueType } from '@bemmoly/module-work/shared';
import type { User } from '@bemmoly/shared';
import {
  avatarHue,
  cardStripe,
  epicStripe,
  type CardPerson,
  type EpicColor,
  type IssueCardProps,
  type IssueTypeRef,
  type LabelValue,
  type Priority,
} from '@bemmoly/ui';
import type { DisplayField } from '../hooks/board-display.ts';
import type { ViewCard } from '../hooks/board-model.ts';

/*
 * From a view card to what the design system's card draws, under the fields this person shows
 * (the board's card fields unless they chose otherwise) and the board's colour rule. The names come from the vocabularies the board loaded once.
 */

/** A colour rule's stripe reads the card's --card-rule, set from the rule's colour. */
export const RULE_STRIPE = 'border-l-(--card-rule)';

const PRIORITIES: ReadonlySet<string> = new Set(['highest', 'high', 'medium', 'low', 'lowest']);

export interface CardVocabulary {
  types: ReadonlyMap<string, Pick<WorkIssueType, 'key' | 'name' | 'level'>>;
  people: ReadonlyMap<string, Pick<User, 'id' | 'name'>>;
  labels: ReadonlyMap<string, LabelValue>;
  meId: string | undefined;
  /** The fields the cards draw: the board's card fields with this person's choices on top. */
  shown: ReadonlySet<DisplayField>;
  colorRule: CardColorRule;
  /** Scrum cards show points; Kanban cards show the time in the column instead. */
  kanban: boolean;
  /** A card in a done column shows a tick for its age on Kanban. */
  doneColumns: ReadonlySet<string>;
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

export function cardProps(
  card: ViewCard,
  vocab: CardVocabulary,
  laneColor: EpicColor | null,
): Omit<IssueCardProps, 'selected' | 'checked' | 'onSelect' | 'className' | 'tools'> {
  const show = (field: DisplayField) => vocab.shown.has(field);
  const priority = cardPriority(card);
  const type = glyphOf(vocab, card.typeId);
  const labels = card.labelIds
    .map((id) => vocab.labels.get(id))
    .filter((label): label is LabelValue => Boolean(label));
  const done = vocab.doneColumns.has(card.columnId);
  return {
    issueKey: card.key,
    showKey: show('key'),
    title: card.title,
    type,
    ...(show('priority') ? { priority } : {}),
    ...(show('assignee') ? { assignee: personOf(vocab, card.assigneeId) } : {}),
    ...(show('labels') && labels.length > 0 ? { labels } : {}),
    ...(!vocab.kanban && show('estimate') && card.estimate !== null
      ? { estimate: card.estimate }
      : {}),
    ...(vocab.kanban && show('age')
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
          epicClassName: epicStripe(
            (card.parentId ? vocab.epicColors.get(card.parentId) : undefined) ?? laneColor,
          ),
        }),
  };
}
