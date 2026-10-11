import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from '../button/icon-button.tsx';
import { KanbanColumnHeader, KanbanColumnHeaders } from './kanban-column.tsx';

const meta = {
  title: 'Components/KanbanColumn',
  component: KanbanColumnHeader,
  args: { name: 'In progress', stage: 'progress', count: 3, wipLimit: 3 },
} satisfies Meta<typeof KanbanColumnHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The review's five headings; "In progress" has reached its WIP limit of 3. */
export const Headings: Story = {
  render: () => (
    <div className="w-300 bg-sunken px-6">
      <KanbanColumnHeaders columns={5}>
        {(
          [
            ['To do', 'todo', 5],
            ['In progress', 'progress', 3, 3],
            ['In review', 'review', 2],
            ['QA', 'qa', 2],
            ['Done', 'done', 3],
          ] as const
        ).map(([name, stage, count, wip]) => (
          <KanbanColumnHeader
            key={name}
            name={name}
            stage={stage}
            count={count}
            {...(wip ? { wipLimit: wip } : {})}
            onAdd={() => undefined}
            menu={<IconButton size="tool" label={`${name} actions`} icon="more" />}
          />
        ))}
      </KanbanColumnHeaders>
    </div>
  ),
};
