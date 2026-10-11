import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { IconButton } from '../button/icon-button.tsx';
import { cardStripe } from './card-stripe.ts';
import { IssueCard } from './issue-card.tsx';
import { IssueCardSkeleton } from './issue-card-skeleton.tsx';

const meta = {
  title: 'Components/IssueCard',
  component: IssueCard,
  args: {
    issueKey: 'PLT-218',
    title: 'Rotate service tokens on every deploy',
    type: 'story',
    priority: 'highest',
    assignee: { name: 'Priya N.', initials: 'PN', hue: 'orange' },
    labels: [
      { name: 'auth', color: '#5B6CD9' },
      { name: 'security', color: '#C2536A' },
    ],
    estimate: 5,
  },
} satisfies Meta<typeof IssueCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The review's hovered card: assign, open in peek and more in the corner. */
export const HoverTools: Story = {
  render: function Render(args) {
    const [selected, setSelected] = useState(false);
    return (
      <div className="w-56 bg-sunken p-3">
        <IssueCard
          {...args}
          selected={selected}
          onSelect={() => setSelected((s) => !s)}
          tools={
            <>
              <IconButton size="tool" label="Assign" icon="user" />
              <IconButton size="tool" label="Open in peek" icon="expand" />
              <IconButton size="tool" label="More actions" icon="more" />
            </>
          }
        />
      </div>
    );
  },
};

/** Blocked, unassigned, checked in a selection, a Kanban age and a colour stripe. */
export const States: Story = {
  render: () => (
    <div className="flex w-56 flex-col gap-2 bg-sunken p-3">
      <IssueCard
        issueKey="PLT-219"
        title="Remove legacy cookie path from monolith"
        type="task"
        priority="low"
        blockedBy="PLT-204"
        estimate={2}
        assignee={null}
      />
      <IssueCard
        issueKey="PLT-226"
        title="Refresh token reused after logout on Safari"
        type="bug"
        priority="high"
        checked
        estimate={2}
        assignee={{ name: 'Lena T.', hue: 'pink' }}
      />
      <IssueCard
        issueKey="SUP-12"
        title="Customer cannot reset their password"
        type="task"
        priority="medium"
        age={{ label: '5d', slow: true }}
        stripeClassName={cardStripe('priority', { priority: 'medium', type: 'task' })}
        assignee={{ name: 'Jonas M.' }}
      />
      <IssueCardSkeleton lines={2} />
    </div>
  ),
};
