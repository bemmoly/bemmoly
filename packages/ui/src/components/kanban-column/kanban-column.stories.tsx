import type { Meta, StoryObj } from '@storybook/react-vite';
import { KanbanColumnHeader, KanbanColumnHeaders } from './kanban-column.tsx';

const meta = {
  title: 'Components/KanbanColumn',
  component: KanbanColumnHeader,
  args: { name: 'In progress', count: 5, wipLimit: 4 },
} satisfies Meta<typeof KanbanColumnHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The five headings of the Board mock; "In progress" is over its WIP limit of 4. */
export const Headings: Story = {
  parameters: {
    mock: [{ file: 'Bemmoly Board.dc.html', x: 280, y: 316, w: 1260, h: 32, note: 'headings' }],
  },
  render: () => (
    <div className="w-327 bg-bg px-6">
      <KanbanColumnHeaders columns={5}>
        <KanbanColumnHeader name="To do" count={7} onAdd={() => {}} />
        <KanbanColumnHeader name="In progress" count={5} wipLimit={4} onAdd={() => {}} />
        <KanbanColumnHeader name="In review" count={2} onAdd={() => {}} />
        <KanbanColumnHeader name="QA" count={2} onAdd={() => {}} />
        <KanbanColumnHeader name="Done" count={5} onAdd={() => {}} />
      </KanbanColumnHeaders>
    </div>
  ),
};
