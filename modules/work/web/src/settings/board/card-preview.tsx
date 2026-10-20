import type { BoardConfig, CardField } from '@bemmoly/module-work/shared';
import { cardStripe, IssueCard } from '@bemmoly/ui';
import type { CSSProperties } from 'react';
import { cardProps, footerOrder, localDay, type CardVocabulary } from '../../board/card-view.ts';
import type { ViewCard } from '../../hooks/board-model.ts';

/*
 * The Cards tab preview draws the board's own card, IssueCard through the same cardProps the
 * board uses, so the preview and the board cannot disagree. Two sample issues: one with a
 * value for every field, and one, like many imported issues, with none of the optional ones,
 * which shows that a chosen field stays off a card whose issue has no value for it.
 */

/** The stripe a colour preset paints on the mock's sample card: a medium-priority story in an epic. */
export const sampleStripe = (rule: BoardConfig['colorRule']) =>
  cardStripe(rule, { priority: 'medium', type: 'story', epicClassName: 'border-l-epic-1' });

const SAMPLE = {
  type: '00000000-0000-7000-8000-000000000001',
  assignee: '00000000-0000-7000-8000-000000000002',
  reporter: '00000000-0000-7000-8000-000000000003',
  label: '00000000-0000-7000-8000-000000000004',
  epic: '00000000-0000-7000-8000-000000000005',
} as const;

const DAY = 24 * 60 * 60 * 1000;
const dayFrom = (today: string, days: number) =>
  new Date(Date.parse(today) + days * DAY).toISOString().slice(0, 10);

function sampleCards(today: string): [ViewCard, ViewCard] {
  const full: ViewCard = {
    issueId: '00000000-0000-7000-8000-000000000010',
    key: 'PLT-211',
    title: 'Session cleanup background job',
    typeId: SAMPLE.type,
    statusId: '00000000-0000-7000-8000-000000000011',
    priority: 'medium',
    assigneeId: SAMPLE.assignee,
    assigneeIds: [SAMPLE.assignee],
    estimate: 3,
    labelIds: [SAMPLE.label],
    rank: 'n',
    blockedBy: ['PLT-204'],
    dueAt: dayFrom(today, 5),
    subtasks: { done: 2, total: 5 },
    parentId: SAMPLE.epic,
    docs: ['RFC'],
    ageDays: 2,
    reporterId: SAMPLE.reporter,
    createdAt: dayFrom(today, -9),
    epicId: SAMPLE.epic,
    columnId: 'doing',
    laneId: 'all',
  };
  const bare: ViewCard = {
    ...full,
    issueId: '00000000-0000-7000-8000-000000000012',
    key: 'PLT-212',
    title: 'Imported issue with no labels, estimate or dates',
    assigneeId: null,
    assigneeIds: [],
    estimate: null,
    labelIds: [],
    blockedBy: [],
    dueAt: null,
    subtasks: null,
    docs: [],
    reporterId: null,
    createdAt: null,
  };
  return [full, bare];
}

export function CardPreview({
  fields,
  colorRule,
  ruleColor,
}: {
  fields: readonly CardField[];
  colorRule: BoardConfig['colorRule'];
  /** The colour of the first rule, painted over the preset as the board would. */
  ruleColor?: string | undefined;
}) {
  const today = localDay();
  const vocab: CardVocabulary = {
    types: new Map([[SAMPLE.type, { key: 'story', name: 'Story', level: 'standard' }]]),
    people: new Map([
      [SAMPLE.assignee, { id: SAMPLE.assignee, name: 'Jonas M.' }],
      [SAMPLE.reporter, { id: SAMPLE.reporter, name: 'Priya N.' }],
    ]),
    labels: new Map([[SAMPLE.label, { name: 'infra' }]]),
    meId: undefined,
    shown: new Set(fields),
    order: footerOrder(fields),
    colorRule,
    doneColumns: new Set(),
    today,
    epicColors: new Map([[SAMPLE.epic, 'epic-1']]),
    epicTargets: new Map(),
    ruleColor: () => ruleColor ?? null,
  };
  const style = ruleColor ? ({ '--card-rule': ruleColor } as CSSProperties) : undefined;
  const [full, bare] = sampleCards(today);
  return (
    <div className="flex w-70 flex-col gap-2">
      <div aria-label="Card preview" style={style}>
        <IssueCard {...cardProps(full, vocab, null)} />
      </div>
      <div aria-label="Card preview, issue without values" style={style}>
        <IssueCard {...cardProps(bare, vocab, null)} />
      </div>
      <p className="m-0 text-12 leading-body text-tx-3">
        A card shows a field only when its issue has a value for it, so imported issues without
        labels, an estimate or dates show fewer.
      </p>
    </div>
  );
}
