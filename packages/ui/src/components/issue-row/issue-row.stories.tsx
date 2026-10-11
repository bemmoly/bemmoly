import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { IssueCreateRow, IssueRow } from './issue-row.tsx';
import { IssueRowSkeleton } from './issue-row-skeleton.tsx';

const meta = {
  title: 'Components/IssueRow',
  component: IssueRow,
  args: {
    issueKey: 'PLT-204',
    title: 'Session store migration to Postgres',
    type: 'story',
    priority: 'highest',
    status: { stage: 'review' },
    estimate: 5,
    assignee: { name: 'Aisha K.', initials: 'AK', hue: 'sky' },
  },
} satisfies Meta<typeof IssueRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A sprint's rows: selection boxes on hover, a blocked row, the epic column and a skeleton. */
export const List: Story = {
  render: function Render(args) {
    const [checked, setChecked] = useState<string[]>([]);
    const flip = (key: string) =>
      setChecked((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));
    return (
      <div className="w-200 bg-canvas">
        {['PLT-204', 'PLT-219', 'PLT-228'].map((key, index) => (
          <IssueRow
            key={key}
            {...args}
            issueKey={key}
            epic={{ name: 'Auth service', color: 'epic-1' }}
            {...(index === 1 ? { blockedBy: 'PLT-204', assignee: null } : {})}
            checked={checked.includes(key)}
            selecting={checked.length > 0}
            onCheck={() => flip(key)}
            selected={index === 2}
          />
        ))}
        <IssueRowSkeleton epic />
        <IssueCreateRow onCreate={() => undefined} />
      </div>
    );
  },
};
