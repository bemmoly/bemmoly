import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { KanbanCard, type KanbanCardProps } from '../kanban-card/kanban-card.tsx';
import {
  KanbanCell,
  KanbanColumnHeader,
  KanbanColumnHeaders,
} from '../kanban-column/kanban-column.tsx';
import { Swimlane, SwimlaneHeader } from './swimlane.tsx';

const meta = { title: 'Components/Swimlane', component: SwimlaneHeader } satisfies Meta<
  typeof SwimlaneHeader
>;

export default meta;

type Story = StoryObj<typeof meta>;

const COLUMNS = [
  { name: 'To do', count: 7 },
  { name: 'In progress', count: 5, wipLimit: 4 },
  { name: 'In review', count: 2 },
  { name: 'QA', count: 2 },
  { name: 'Done', count: 5 },
];

const CARDS: (KanbanCardProps & { column: number })[] = [
  {
    column: 0,
    issueKey: 'PLT-222',
    title: 'Rate-limit token refresh endpoint',
    type: 'task',
    priority: 'medium',
    labels: ['api'],
    doc: 'RFC',
    estimate: 3,
    assignee: { name: 'Aisha K.', initials: 'AK', hue: 'orange' },
  },
  {
    column: 0,
    issueKey: 'PLT-219',
    title: 'Remove legacy cookie path from monolith',
    type: 'task',
    priority: 'low',
    blockedBy: 'PLT-204',
    estimate: 2,
    assignee: { name: 'Jonas M.', initials: 'JM', hue: 'violet' },
  },
  {
    column: 1,
    issueKey: 'PLT-218',
    title: 'Rotate service tokens on every deploy',
    type: 'story',
    priority: 'highest',
    labels: ['auth', 'security'],
    doc: 'RFC',
    subtasks: { done: 1, total: 3 },
    estimate: 5,
    assignee: { name: 'Priya N.', initials: 'PN', hue: 'green' },
  },
  {
    column: 2,
    issueKey: 'PLT-204',
    title: 'Session store migration to Postgres',
    type: 'story',
    priority: 'highest',
    labels: ['auth', 'infra'],
    doc: 'RFC',
    subtasks: { done: 2, total: 4 },
    estimate: 5,
    selected: true,
    assignee: { name: 'Aisha K.', initials: 'AK', hue: 'orange' },
  },
  {
    column: 3,
    issueKey: 'PLT-209',
    title: 'Health checks and alerting for auth service',
    type: 'task',
    priority: 'medium',
    labels: ['ops'],
    estimate: 1,
    assignee: { name: 'Rohan S.', initials: 'RS', hue: 'accent' },
  },
  {
    column: 4,
    issueKey: 'PLT-198',
    title: 'SSO with Google Workspace and Okta',
    type: 'story',
    priority: 'high',
    labels: ['auth'],
    estimate: 3,
    assignee: { name: 'Priya N.', initials: 'PN', hue: 'green' },
  },
];

/** The column headings and the Auth service lane of the Board mock. */
export const AuthServiceLane: Story = {
  args: { name: 'Auth service', open: true, onToggle: () => {} },
  parameters: {
    layout: 'fullscreen',
    mock: [{ file: 'Bemmoly Board.dc.html', x: 280, y: 316, w: 1260, h: 420, note: 'lane' }],
  },
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <div className="flex w-327 flex-col bg-bg px-6 pb-6">
        <KanbanColumnHeaders columns={COLUMNS.length}>
          {COLUMNS.map((column) => (
            <KanbanColumnHeader key={column.name} {...column} onAdd={() => {}} />
          ))}
        </KanbanColumnHeaders>
        <Swimlane
          id="lane-auth"
          columns={COLUMNS.length}
          open={open}
          header={
            <SwimlaneHeader
              name="Auth service"
              laneKey="PLT-180"
              meta="9 issues · 26 pts"
              progress={19}
              due="Due Oct 7"
              open={open}
              onToggle={() => setOpen((o) => !o)}
              controls="lane-auth"
            />
          }
        >
          {COLUMNS.map((column, index) => (
            <KanbanCell key={column.name} label={`${column.name}, Auth service`}>
              {CARDS.filter((card) => card.column === index).map(({ column: _c, ...card }) => (
                <KanbanCard key={card.issueKey} {...card} onSelect={() => {}} />
              ))}
            </KanbanCell>
          ))}
        </Swimlane>
      </div>
    );
  },
};

/** A collapsed lane in a different hue, and a cell while a card is dragged over it. */
export const CollapsedAndDropping: Story = {
  args: { name: 'Billing v2', open: false, onToggle: () => {} },
  parameters: { layout: 'fullscreen', mock: undefined },
  render: () => (
    <div className="flex w-190 flex-col gap-2.5 bg-bg p-6">
      <Swimlane
        columns={5}
        open={false}
        header={
          <SwimlaneHeader
            name="Billing v2"
            laneKey="PLT-150"
            meta="6 issues · 16 pts"
            progress={6}
            due="Due Oct 21"
            colorClassName="bg-violet"
            open={false}
            onToggle={() => {}}
          />
        }
      />
      <Swimlane
        columns={5}
        open
        header={
          <SwimlaneHeader
            name="No epic"
            meta="4 issues · 6 pts"
            progress={50}
            colorClassName="bg-tx6"
            open
            onToggle={() => {}}
          />
        }
      >
        <KanbanCell label="To do, No epic" />
        <KanbanCell label="In progress, No epic" dropping />
        <KanbanCell label="In review, No epic" />
        <KanbanCell label="QA, No epic" />
        <KanbanCell label="Done, No epic" />
      </Swimlane>
    </div>
  ),
};
