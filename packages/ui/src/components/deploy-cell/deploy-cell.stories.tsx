import type { Meta, StoryObj } from '@storybook/react-vite';
import type { LaneDot } from '../lane/lane.tsx';
import { DeployCell, type DeployCellProps } from './deploy-cell.tsx';

const meta = {
  title: 'Pipelines/DeployCell',
  component: DeployCell,
  args: {
    count: '210',
    secondary: '2 moving',
    dots: [
      { id: 'a', state: 'running', position: 0.3 },
      { id: 'b', state: 'running', position: 0.62 },
    ],
    flags: [{ tone: 'danger', text: '1 failed' }],
    label: 'Staging: 210 applications, 2 moving, 1 failed',
  },
} satisfies Meta<typeof DeployCell>;

export default meta;

/** One cell at a map column's width, on a card as the map draws it. */
const inCard: NonNullable<Story['decorators']> = [
  (Story) => <div className="w-44 rounded-card bg-card p-2.5 shadow-e1">{Story()}</div>,
];

type Story = StoryObj<typeof meta>;

export const Moving: Story = {
  decorators: inCard,
};

export const MovingDark: Story = {
  decorators: inCard,
  globals: { mode: 'dark' },
};

export const Calm: Story = {
  decorators: inCard,
  args: { count: '208', secondary: null, dots: [], flags: [] },
};

export const Waiting: Story = {
  decorators: inCard,
  args: {
    count: '206',
    secondary: null,
    dots: [{ id: 'w', state: 'waiting', position: 0.08 }],
    flags: [{ tone: 'warn', text: '1 waiting' }],
  },
};

export const Notes: Story = {
  decorators: inCard,
  args: {
    count: '101',
    secondary: null,
    dots: [],
    flags: [{ tone: 'accent', text: 'train 11:00' }],
  },
};

export const Rewound: Story = {
  decorators: inCard,
  args: { still: true },
};

const COLUMNS = ['Build and test', 'Dev', 'Staging', 'Prod asia', 'Prod us', 'Prod eu'];

function cellAt(row: number, column: number): DeployCellProps {
  const seed = row * 7 + column * 3;
  const moving = seed % 4;
  const dots: LaneDot[] = Array.from({ length: moving }, (_, index) => ({
    id: `${row}-${column}-${index}`,
    state: seed % 13 === 0 ? 'failed' : seed % 9 === 0 ? 'waiting' : 'running',
    position: ((seed * 37 + index * 29) % 90) / 100,
  }));
  return {
    count: column === 0 ? `${(seed % 40) + 3} running` : String(200 - (seed % 9)),
    secondary: column > 0 && moving ? `${moving} moving` : null,
    dots,
    flags: seed % 13 === 0 ? [{ tone: 'danger', text: '1 failed' }] : [],
    label: `${COLUMNS[column] ?? ''}: ${moving} moving`,
  };
}

/** A whole map's worth (100 rows by 6 columns): the motion is CSS only, so it stays smooth. */
export const ManyCells: Story = {
  render: () => (
    <div className="grid grid-cols-6 gap-x-3 gap-y-3">
      {Array.from({ length: 100 * 6 }, (_, index) => (
        <DeployCell key={index} {...cellAt(Math.floor(index / 6), index % 6)} />
      ))}
    </div>
  ),
};
