import type { Meta, StoryObj } from '@storybook/react-vite';
import { BarChart } from './bar-chart.tsx';
import { LineChart } from './line-chart.tsx';
import { ScatterChart } from './scatter-chart.tsx';

const DAYS = ['Mar 10', 'Mar 11', 'Mar 12', 'Mar 13', 'Mar 14', 'Mar 17', 'Mar 18'];

const meta = {
  title: 'Components/Chart',
  component: LineChart,
  args: {
    label: 'Sprint 15 burndown',
    xLabels: DAYS,
    series: [
      {
        id: 'guide',
        label: 'Guideline',
        tone: 'muted',
        dashed: true,
        values: [23, 19, 15, 11, 8, 4, 0],
      },
      { id: 'remaining', label: 'Remaining', tone: 'prog', values: [23, 21, 21, 16, 13, 9, null] },
    ],
  },
} satisfies Meta<typeof LineChart>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A burndown: the remaining points against the dashed guideline. */
export const Burndown: Story = {};

/** A burnup: scope over completed, scope rising when work joins mid-sprint. */
export const Burnup: Story = {
  args: {
    label: 'Sprint 15 burnup',
    series: [
      { id: 'scope', label: 'Scope', tone: 'ink', values: [23, 23, 26, 26, 26, 24, 24] },
      { id: 'done', label: 'Completed', tone: 'done', values: [0, 2, 2, 8, 11, 15, 19] },
    ],
  },
};

/** The cumulative flow: to do, in progress and done stacked. */
export const CumulativeFlow: Story = {
  args: {
    label: 'Cumulative flow',
    stacked: true,
    series: [
      { id: 'done', label: 'Done', tone: 'done', values: [4, 5, 7, 9, 10, 13, 15] },
      { id: 'prog', label: 'In progress', tone: 'prog', values: [3, 4, 4, 3, 5, 4, 3] },
      { id: 'todo', label: 'To do', tone: 'todo', values: [12, 12, 11, 12, 10, 9, 9] },
    ],
  },
};

/** Velocity: committed and completed points over the last closed sprints. */
export const Velocity: Story = {
  render: () => (
    <BarChart
      label="Velocity"
      xLabels={['Sprint 11', 'Sprint 12', 'Sprint 13', 'Sprint 14']}
      series={[
        { id: 'committed', label: 'Committed', tone: 'todo', values: [21, 24, 20, 26] },
        { id: 'completed', label: 'Completed', tone: 'done', values: [18, 24, 17, 22] },
      ]}
    />
  ),
};

const DAY = 86_400_000;
const START = Date.parse('2026-03-01T00:00:00Z');
const CYCLES = [1.5, 4, 2.5, 7, 3, 1, 9.5, 2, 3.5, 5, 2.5, 4.5];

/** The control chart: each finished issue's cycle time, with the mean and median. */
export const Control: Story = {
  render: () => (
    <ScatterChart
      label="Control chart"
      pointLabel="Issue"
      yLabel="Cycle days"
      xDomain={[START, START + 30 * DAY]}
      xTicks={[0, 10, 20, 30].map((day) => ({
        value: START + day * DAY,
        label: `Mar ${day + 1}`,
      }))}
      formatX={(x) => new Date(x).toISOString().slice(0, 10)}
      points={CYCLES.map((cycle, index) => ({
        x: START + (index * 2.4 + 1) * DAY,
        y: cycle,
        label: `PLT-${200 + index}`,
      }))}
      references={[
        { id: 'mean', label: 'Mean 3.8 days', value: 3.8, tone: 'ink' },
        { id: 'median', label: 'Median 3.3 days', value: 3.3, tone: 'muted' },
      ]}
    />
  ),
};
