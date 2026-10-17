import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { MetricCompare } from './metric-compare.tsx';
import { SeriesChart } from './series-chart.tsx';

const series = (base: number) => [0, 1, 2].map((at) => ({ at, value: base + at }));

describe('MetricCompare', () => {
  it('shows both sides, the verdict and names the chart', async () => {
    const { container } = render(
      <MetricCompare
        label="Error rate"
        canary={{ label: 'Canary', value: '1.9%', series: series(1) }}
        stable={{ label: 'Stable', value: null, series: series(0) }}
        verdict="fail"
        verdictLabel="Above stable"
        emptyValue="No data"
      />,
    );
    expect(screen.getByText('Above stable')).toBeTruthy();
    expect(screen.getByText('No data')).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Error rate: Canary 1.9%, Stable No data',
    );
    await expectAccessible(container);
  });
});

describe('SeriesChart', () => {
  it('draws a line, bars, markers with their labels and a threshold', () => {
    const { container, rerender } = render(
      <SeriesChart
        points={series(1)}
        markers={[{ key: 'm', at: 1, label: 'cart-api v8.2.1', tone: 'warn' }]}
        threshold={2}
        ariaLabel="5xx rate"
      />,
    );
    expect(container.querySelectorAll('polyline')).toHaveLength(1);
    expect(container.querySelectorAll('line')).toHaveLength(2);
    expect(screen.getByText('cart-api v8.2.1')).toBeTruthy();
    rerender(<SeriesChart kind="bars" points={series(1)} ariaLabel="Jobs" />);
    expect(container.querySelectorAll('rect')).toHaveLength(3);
  });
});
