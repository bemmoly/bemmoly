import type { BoardView, WorkflowStatus } from '@bemmoly/module-work/shared';
import {
  Avatar,
  Drawer,
  DrawerTitle,
  IconButton,
  KeyChip,
  PriorityGlyph,
  Tag,
  TypeGlyph,
} from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { cardProps, laneFill, type CardVocabulary } from './card-view.ts';

/*
 * The board's adapter to the issue slide-over. The issue screens own the panel
 * (IssueSlideOver in ../issue); until that lands on this branch, the adapter shows what the
 * board already holds for the card in the same docked drawer, with the full page one click
 * away. Swapping the body for <IssueSlideOver issueKey onClose /> is the whole change.
 */

export interface BoardSlideOverProps {
  issueKey: string | null;
  view: BoardView;
  vocab: CardVocabulary;
  statuses: readonly WorkflowStatus[];
  laneHue: (laneId: string) => number | null;
  onClose(): void;
  onOpenPage(key: string): void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="py-1.5 text-tx4">{label}</dt>
      <dd className="m-0 flex items-center gap-1.5 py-1.5">{children}</dd>
    </>
  );
}

export function BoardSlideOver({
  issueKey,
  view,
  vocab,
  statuses,
  laneHue,
  onClose,
  onOpenPage,
}: BoardSlideOverProps) {
  const card = issueKey ? view.cards.find((entry) => entry.key === issueKey) : undefined;
  if (!issueKey || !card) return null;
  const props = cardProps(card, { ...vocab, fields: ['assignee', 'labels', 'estimate'] }, null);
  const lane = view.lanes.find((entry) => entry.id === card.laneId);
  const status = statuses.find((entry) => entry.id === card.statusId);
  return (
    <Drawer
      open
      onClose={onClose}
      label={`${card.key} details`}
      header={
        <>
          {lane && lane.id !== 'all' && (
            <>
              <span aria-hidden className={`size-2.5 rounded-chip ${laneFill(laneHue(lane.id))}`} />
              <span className="truncate">{lane.label}</span>
              <span aria-hidden>/</span>
            </>
          )}
          <TypeGlyph type={props.type} />
          <KeyChip issueKey={card.key} size="md" />
        </>
      }
      actions={
        <IconButton
          label="Open full page"
          icon="expand"
          size="xs"
          onClick={() => onOpenPage(card.key)}
        />
      }
    >
      <DrawerTitle>{card.title}</DrawerTitle>
      <dl className="m-0 grid grid-cols-[110px_1fr] items-center rounded-card border border-br px-3 py-1.5 text-12h">
        <Row label="Status">{status?.name ?? '—'}</Row>
        <Row label="Assignee">
          {props.assignee ? (
            <>
              <Avatar name={props.assignee.name} hue={props.assignee.hue} size={20} />
              {props.assignee.name}
            </>
          ) : (
            'Unassigned'
          )}
        </Row>
        <Row label="Priority">
          <PriorityGlyph priority={props.priority} showLabel />
        </Row>
        <Row label={vocab.kanban ? 'Size' : 'Story points'}>
          <span className="font-mono">{card.estimate ?? '—'}</span>
        </Row>
        {props.labels && (
          <Row label="Labels">
            {props.labels.map((label) => (
              <Tag key={label}>{label}</Tag>
            ))}
          </Row>
        )}
        {card.blockedBy.length > 0 && <Row label="Blocked by">{card.blockedBy.join(', ')}</Row>}
      </dl>
    </Drawer>
  );
}
