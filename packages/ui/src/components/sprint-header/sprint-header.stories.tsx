import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { BacklogCreateRow, BacklogRow, type BacklogRowProps } from '../backlog-row/backlog-row.tsx';
import { SprintContainer, SprintHeader } from './sprint-header.tsx';

const meta = {
  title: 'Components/SprintHeader',
  component: SprintHeader,
  args: {
    name: 'PLT Sprint 14',
    dates: 'Sep 23 – Oct 7',
    active: true,
    issueCount: 7,
    counts: { todo: 2, doing: 5, done: 0 },
    capacity: '23 pts · 14 done',
    action: 'Complete sprint',
    open: true,
    onToggle: () => {},
    onMore: () => {},
  },
} satisfies Meta<typeof SprintHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const ROWS: BacklogRowProps[] = [
  {
    issueKey: 'PLT-204',
    title: 'Session store migration to Postgres',
    type: 'story',
    priority: 'highest',
    status: { category: 'review' },
    epic: { name: 'Auth service', colorClassName: 'bg-ac' },
    estimate: 5,
    doc: 'RFC',
    assignee: { name: 'Aisha K.', initials: 'AK', hue: 'orange' },
  },
  {
    issueKey: 'PLT-218',
    title: 'Rotate service tokens on every deploy',
    type: 'story',
    priority: 'highest',
    status: { category: 'progress' },
    epic: { name: 'Auth service', colorClassName: 'bg-ac' },
    estimate: 5,
    doc: 'RFC',
    assignee: { name: 'Priya N.', initials: 'PN', hue: 'green' },
  },
  {
    issueKey: 'PLT-226',
    title: 'Refresh token reused after logout on Safari',
    type: 'bug',
    priority: 'high',
    status: { category: 'progress' },
    epic: { name: 'Auth service', colorClassName: 'bg-ac' },
    estimate: 2,
    assignee: { name: 'Lena T.', initials: 'LT', hue: 'pink' },
  },
  {
    issueKey: 'PLT-211',
    title: 'Session cleanup background job',
    type: 'story',
    priority: 'medium',
    status: { category: 'todo' },
    epic: { name: 'Auth service', colorClassName: 'bg-ac' },
    estimate: 3,
    assignee: { name: 'Jonas M.', initials: 'JM', hue: 'violet' },
  },
];

/** The active sprint of the Backlog mock, with its rows and the create line. */
export const ActiveSprint: Story = {
  parameters: {
    layout: 'fullscreen',
    mock: [{ file: 'Bemmoly Backlog.dc.html', x: 524, y: 202, w: 892, h: 280, note: 'Sprint 14' }],
  },
  render: function Render(args) {
    const [open, setOpen] = useState(true);
    const [selected, setSelected] = useState<string | null>(null);
    return (
      <div className="w-223 bg-bg px-6 py-4">
        <SprintContainer
          id="sprint-14"
          active
          open={open}
          header={
            <SprintHeader
              {...args}
              open={open}
              onToggle={() => setOpen((o) => !o)}
              controls="sprint-14"
            />
          }
        >
          {ROWS.map((row) => (
            <BacklogRow
              key={row.issueKey}
              {...row}
              selected={selected === row.issueKey}
              onSelect={() => setSelected(row.issueKey)}
            />
          ))}
          <BacklogCreateRow onCreate={() => {}} />
        </SprintContainer>
      </div>
    );
  },
};

/** The next sprint and the backlog itself, collapsed. */
export const PlannedAndBacklog: Story = {
  parameters: { layout: 'fullscreen', mock: undefined },
  render: () => (
    <div className="flex w-223 flex-col gap-4 bg-bg px-6 py-4">
      <SprintContainer
        open={false}
        header={
          <SprintHeader
            name="PLT Sprint 15"
            dates="Oct 7 – Oct 21"
            goal="Billing v2 invoices in beta"
            issueCount={5}
            counts={{ todo: 5, doing: 0, done: 0 }}
            capacity={<span className="text-ok-fg">19 of ~22 pts capacity</span>}
            action="Start sprint"
            onMore={() => {}}
            open={false}
            onToggle={() => {}}
          />
        }
      />
      <SprintContainer
        open={false}
        header={
          <SprintHeader
            name="Backlog"
            issueCount={8}
            counts={{ todo: 8, doing: 0, done: 0 }}
            action="Create sprint"
            onMore={() => {}}
            open={false}
            onToggle={() => {}}
          />
        }
      />
    </div>
  ),
};
