import type { Meta, StoryObj } from '@storybook/react-vite';
import { SeriesChart } from '../metric-compare/series-chart.tsx';
import { StatTile } from './stat-tile.tsx';

const meta = {
  title: 'Pipelines/StatTile',
  component: StatTile,
  args: { label: 'Running', value: '214', detail: 'of 358 slots' },
  decorators: [(Story) => <div className="max-w-56">{Story()}</div>],
} satisfies Meta<typeof StatTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Running: Story = {};

export const RunningDark: Story = { globals: { mode: 'dark' } };

export const BetterWithTrend: Story = {
  args: {
    label: 'Median lead time',
    value: '3h 10m',
    detail: 'Down 12% on the 90 days before',
    detailTone: 'better',
    children: (
      <SeriesChart
        height={40}
        points={[5, 4.6, 4.8, 4.1, 3.9, 3.4, 3.2].map((value, at) => ({ at, value }))}
        ariaLabel="Median lead time by week"
      />
    ),
  },
};

export const Worse: Story = {
  args: {
    label: 'Change failure rate',
    value: '2.4%',
    detail: 'Up 0.6 points on the 90 days before',
    detailTone: 'worse',
  },
};
