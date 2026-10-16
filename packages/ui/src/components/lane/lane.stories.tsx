import type { Meta, StoryObj } from '@storybook/react-vite';
import { Lane, type LaneDot } from './lane.tsx';

const MOVING: LaneDot[] = [
  { id: 'a', state: 'running', position: 0.1 },
  { id: 'b', state: 'running', position: 0.45 },
  { id: 'c', state: 'running', position: 0.7 },
];

const meta = {
  title: 'Pipelines/Lane',
  component: Lane,
  args: { dots: MOVING, label: '3 moving' },
  decorators: [(Story) => <div className="w-40">{Story()}</div>],
} satisfies Meta<typeof Lane>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Moving: Story = {};

export const MovingDark: Story = { globals: { mode: 'dark' } };

/** Rewound to a moment in the past: the same dots, holding still. */
export const Still: Story = { args: { still: true } };

export const Calm: Story = { args: { dots: [], label: undefined } };

export const WaitingAndFailed: Story = {
  args: {
    dots: [
      { id: 'w', state: 'waiting', position: 0.08 },
      { id: 'f', state: 'failed', position: 0.4 },
      { id: 'r', state: 'running', position: 0.6 },
    ],
    label: '1 moving, 1 waiting, 1 failed',
  },
};

/** A map's worth of cells: the motion is CSS only, so 60 lanes stay smooth. */
export const ManyCells: Story = {
  decorators: [(Story) => <div className="w-full">{Story()}</div>],
  render: () => (
    <div className="grid grid-cols-6 gap-x-3 gap-y-4">
      {Array.from({ length: 60 }, (_, index) => (
        <Lane
          key={index}
          dots={
            index % 4 === 0
              ? []
              : Array.from({ length: (index % 3) + 1 }, (_, dot) => ({
                  id: `${index}-${dot}`,
                  state: index % 11 === 0 ? 'failed' : index % 7 === 0 ? 'waiting' : 'running',
                  position: ((index * 37 + dot * 29) % 90) / 100,
                }))
          }
        />
      ))}
    </div>
  ),
};
