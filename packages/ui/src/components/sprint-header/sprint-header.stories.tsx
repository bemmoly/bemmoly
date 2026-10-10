import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { IssueCreateRow, IssueRow } from '../issue-row/issue-row.tsx';
import { SprintContainer, SprintHeader } from './sprint-header.tsx';

const meta = {
  title: 'Components/SprintHeader',
  component: SprintHeader,
  args: {
    name: 'Sprint 14',
    kind: 'active',
    dates: 'Sep 23 – Oct 7',
    goal: 'Ship the auth service to GA',
    issueCount: 15,
    points: { done: 9, doing: 11, total: 48 },
    action: 'Complete',
    open: true,
    onToggle: () => undefined,
    onMore: () => undefined,
  },
} satisfies Meta<typeof SprintHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The active sprint over its rows, then the collapsed backlog. */
export const Containers: Story = {
  render: function Render(args) {
    const [open, setOpen] = useState(true);
    return (
      <div className="w-250 bg-canvas">
        <SprintContainer
          id="s14"
          open={open}
          header={
            <SprintHeader
              {...args}
              open={open}
              onToggle={() => setOpen((o) => !o)}
              controls="s14"
            />
          }
        >
          <IssueRow
            issueKey="PLT-222"
            title="Rate-limit token refresh endpoint"
            type="task"
            priority="medium"
            status={{ stage: 'todo' }}
            estimate={3}
            assignee={{ name: 'Aisha K.' }}
          />
          <IssueCreateRow onCreate={() => undefined} />
        </SprintContainer>
        <SprintContainer
          open={false}
          header={
            <SprintHeader
              name="Backlog"
              kind="backlog"
              issueCount={16}
              action="Create sprint"
              open={false}
              onToggle={() => undefined}
            />
          }
        />
      </div>
    );
  },
};
