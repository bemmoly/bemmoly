import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { cardStripe } from './card-stripe.ts';
import { KanbanCard } from './kanban-card.tsx';

const meta = {
  title: 'Components/KanbanCard',
  component: KanbanCard,
  args: {
    issueKey: 'PLT-204',
    title: 'Session store migration to Postgres',
    type: 'story',
    priority: 'highest',
    assignee: { name: 'Aisha K.', initials: 'AK', hue: 'orange' },
    labels: ['auth', 'infra'],
    estimate: 5,
    doc: 'RFC',
    subtasks: { done: 2, total: 4 },
  },
} satisfies Meta<typeof KanbanCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The "In review" column of the Auth service lane: the selected card. */
export const Selected: Story = {
  args: { selected: true },
  parameters: {
    mock: [{ file: 'Bemmoly Board.dc.html', x: 776, y: 402, w: 238, h: 128, note: 'PLT-204' }],
  },
  render: function Render(args) {
    const [selected, setSelected] = useState(true);
    return (
      <div className="w-64.5 bg-bg2 p-2.5">
        <KanbanCard {...args} selected={selected} onSelect={() => setSelected((s) => !s)} />
      </div>
    );
  },
};

/** A blocked card in "To do", and a Kanban card with its time in column. */
export const BlockedAndKanban: Story = {
  parameters: {
    mock: [
      { file: 'Bemmoly Board.dc.html', x: 280, y: 532, w: 238, h: 126, note: 'PLT-219 blocked' },
    ],
  },
  render: () => (
    <div className="flex w-59.5 flex-col gap-2 bg-bg2 p-2.5">
      <KanbanCard
        issueKey="PLT-219"
        title="Remove legacy cookie path from monolith"
        type="task"
        priority="low"
        blockedBy="PLT-204"
        estimate={2}
        assignee={{ name: 'Jonas M.', initials: 'JM', hue: 'violet' }}
        onSelect={() => {}}
      />
      <KanbanCard
        issueKey="PLT-226"
        title="Refresh token reused after logout on Safari"
        type="bug"
        priority="high"
        labels={['security']}
        age={{ label: '5d', slow: true }}
        assignee={{ name: 'Lena T.', initials: 'LT', hue: 'pink' }}
        dimmed
      />
    </div>
  ),
};

/** The Board Settings card preview with the "By epic" colour rule. */
export const ColourStripe: Story = {
  parameters: { mock: undefined },
  render: () => (
    <div className="flex w-70 flex-col gap-2 bg-bg p-2.5">
      {(['priority', 'type', 'epic'] as const).map((rule) => (
        <KanbanCard
          key={rule}
          issueKey="PLT-211"
          title="Session cleanup background job"
          type="story"
          priority="medium"
          labels={['infra', 'auth']}
          doc="RFC"
          estimate={3}
          blockedBy="PLT-204"
          assignee={{ name: 'Jonas M.', initials: 'JM', hue: 'violet' }}
          stripeClassName={cardStripe(rule, {
            priority: 'medium',
            type: 'story',
            epicClassName: 'border-l-ac',
          })}
        />
      ))}
    </div>
  ),
};
