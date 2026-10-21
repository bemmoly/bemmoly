import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { IconButton } from '../button/icon-button.tsx';
import { cardStripe } from './card-stripe.ts';
import { DateWarningChip } from './issue-atoms.tsx';
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
        issueKey="PLT-230"
        title="Usage-based invoice line items"
        type="story"
        priority="medium"
        due={{ label: 'Dec 9' }}
        warning={<DateWarningChip>Due after PLT-12</DateWarningChip>}
        estimate={5}
        assignee={{ name: 'Lena T.', hue: 'pink' }}
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
      <IssueCard
        issueKey="PLT-231"
        title="Pair on the session store cut-over"
        type="story"
        priority="high"
        estimate={5}
        assignee={{ name: 'Priya N.', hue: 'orange' }}
        coAssignees={[{ name: 'Lena T.', hue: 'pink' }, { name: 'Jonas M.' }, { name: 'Aisha K.' }]}
      />
      <IssueCardSkeleton lines={2} />
    </div>
  ),
};

/**
 * A board's card fields: every part a board can show, a board that shows only the title and
 * labels, and the footer in a board's own order (due date first, the assignee before points).
 */
export const BoardFields: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-2 bg-sunken p-3">
      <IssueCard
        issueKey="PLT-211"
        title="Session cleanup background job"
        type="story"
        priority="medium"
        labels={['infra']}
        estimate={3}
        age={{ label: '2d' }}
        doc="RFC"
        subtasks={{ done: 2, total: 5 }}
        due={{ label: 'Oct 6', overdue: true }}
        created="Sep 28"
        reporter={{ name: 'Priya N.', hue: 'green' }}
        assignee={{ name: 'Jonas M.', hue: 'violet' }}
      />
      <IssueCard
        issueKey="PLT-212"
        title="Rotate the signing keys"
        type="task"
        showType={false}
        showKey={false}
        labels={['security']}
      />
      <IssueCard
        issueKey="PLT-213"
        title="Archive closed sprints"
        type="task"
        due={{ label: 'Oct 20' }}
        estimate={2}
        assignee={{ name: 'Lena T.', hue: 'pink' }}
        order={['due', 'key', 'assignee', 'estimate']}
      />
    </div>
  ),
};
