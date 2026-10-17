import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { BarChart } from './bar-chart.tsx';
import { labelEvery, niceTicks } from './chart-frame.tsx';
import { LineChart } from './line-chart.tsx';
import { ScatterChart } from './scatter-chart.tsx';

describe('charts', () => {
  it('names the plot and prints every number in a hidden table', async () => {
    const { container } = render(
      <div>
        <LineChart
          label="Burndown"
          xLabels={['Mar 10', 'Mar 11']}
          series={[{ id: 'r', label: 'Remaining', tone: 'prog', values: [8, null] }]}
        />
        <BarChart
          label="Velocity"
          xLabels={['Sprint 1']}
          series={[{ id: 'c', label: 'Completed', tone: 'done', values: [5] }]}
        />
      </div>,
    );
    await expectAccessible(container);
    expect(screen.getByRole('img', { name: 'Burndown' })).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Burndown' });
    expect(within(table).getByRole('rowheader', { name: 'Mar 10' })).toBeTruthy();
    expect(within(table).getByRole('cell', { name: '8' })).toBeTruthy();
    expect(container.querySelectorAll('rect')).toHaveLength(1);
  });

  it('stacks bands so the top edge is the total', () => {
    const { container } = render(
      <LineChart
        label="Flow"
        stacked
        xLabels={['a', 'b']}
        series={[
          { id: 'done', label: 'Done', tone: 'done', values: [1, 2] },
          { id: 'todo', label: 'To do', tone: 'todo', values: [3, 2] },
        ]}
      />,
    );
    expect(container.querySelectorAll('path.fill-todo')).toHaveLength(1);
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
  });

  it('rounds the axis and thins the labels', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(23)).toEqual([0, 10, 20, 30]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(labelEvery(30, 320)).toBe(6);
    expect(labelEvery(5, 640)).toBe(1);
  });

  it('draws a dot per point and a dashed line per reference, each point in the table', async () => {
    const { container } = render(
      <ScatterChart
        label="Control chart"
        pointLabel="Issue"
        yLabel="Cycle days"
        xDomain={[0, 10]}
        xTicks={[{ value: 0, label: 'start' }]}
        formatX={(x) => `day ${x}`}
        points={[
          { x: 2, y: 3, label: 'PLT-1' },
          { x: 8, y: 1, label: 'PLT-2' },
        ]}
        references={[{ id: 'mean', label: 'Mean', value: 2, tone: 'ink' }]}
      />,
    );
    await expectAccessible(container);
    expect(container.querySelectorAll('circle')).toHaveLength(2);
    expect(container.querySelectorAll('line[stroke-dasharray]')).toHaveLength(1);
    const table = screen.getByRole('table', { name: 'Control chart' });
    expect(within(table).getByRole('rowheader', { name: 'PLT-2' })).toBeTruthy();
    expect(within(table).getByRole('cell', { name: 'day 8' })).toBeTruthy();
  });
});
