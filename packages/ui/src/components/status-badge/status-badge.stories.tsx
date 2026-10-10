import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusBadge, StatusButton, type StatusCategory } from './status-badge.tsx';

const CATEGORIES: StatusCategory[] = ['todo', 'progress', 'review', 'qa', 'done'];

const meta = {
  title: 'Components/StatusBadge',
  component: StatusBadge,
  args: { category: 'review', size: 'md' },
  argTypes: {
    category: { control: 'inline-radio', options: CATEGORIES },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AllSizes: Story = {
  parameters: {
    mock: [
      { file: 'Bemmoly Board.dc.html', x: 1056, y: 152, w: 120, h: 42, note: 'drawer status (lg)' },
      { file: 'Bemmoly Board.dc.html', x: 1290, y: 598, w: 140, h: 132, note: 'subtasks (sm)' },
      { file: 'Bemmoly Backlog.dc.html', x: 980, y: 290, w: 150, h: 200, note: 'rows (md)' },
      { file: 'Bemmoly Doc Editor.dc.html', x: 670, y: 612, w: 170, h: 92, note: 'inline (xs)' },
    ],
  },
  render: () => (
    <div className="flex flex-col gap-3 bg-card p-3">
      {(['xs', 'sm', 'md'] as const).map((size) => (
        <div key={size} className="flex items-center gap-2">
          {CATEGORIES.map((c) => (
            <StatusBadge key={c} category={c} size={size} />
          ))}
          <span className="text-11 text-tx-3">{size}</span>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <StatusButton category="review" />
        <StatusButton category="review" size="xl" />
      </div>
    </div>
  ),
};
