import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { epicFill } from '../issue-card/epic-color.ts';
import { IssueCard } from '../issue-card/issue-card.tsx';
import { KanbanCell } from '../kanban-column/kanban-column.tsx';
import { Swimlane, SwimlaneHeader } from './swimlane.tsx';

const meta = {
  title: 'Components/Swimlane',
  component: SwimlaneHeader,
  args: {
    name: 'Auth service',
    laneKey: 'PLT-190',
    meta: '9 issues · 26 pts',
    progress: 63,
    due: 'Due Oct 12',
    colorClassName: epicFill('epic-1'),
    open: true,
    onToggle: () => undefined,
  },
} satisfies Meta<typeof SwimlaneHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** One epic lane with three columns; the toggle collapses it. */
export const Lane: Story = {
  render: function Render(args) {
    const [open, setOpen] = useState(true);
    return (
      <div className="w-200 bg-sunken p-6">
        <Swimlane
          id="lane-auth"
          columns={3}
          open={open}
          header={
            <SwimlaneHeader
              {...args}
              open={open}
              onToggle={() => setOpen((o) => !o)}
              controls="lane-auth"
            />
          }
        >
          <KanbanCell label="To do, Auth service">
            <IssueCard
              issueKey="PLT-222"
              title="Rate-limit token refresh endpoint"
              type="task"
              priority="medium"
              estimate={3}
              assignee={{ name: 'Aisha K.' }}
            />
          </KanbanCell>
          <KanbanCell label="In progress, Auth service" dropping />
          <KanbanCell label="Done, Auth service" />
        </Swimlane>
      </div>
    );
  },
};
