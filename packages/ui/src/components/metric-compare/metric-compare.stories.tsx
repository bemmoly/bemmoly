import type { Meta, StoryObj } from '@storybook/react-vite';
import { MetricCompare } from './metric-compare.tsx';
import { SeriesChart, type SeriesPoint } from './series-chart.tsx';

const wave = (base: number, lift = 0): SeriesPoint[] =>
  Array.from({ length: 30 }, (_, i) => ({
    at: i,
    value: base + Math.sin(i / 3) * base * 0.15 + (i > 20 ? (i - 20) * lift : 0),
  }));

const meta = {
  title: 'Pipelines/MetricCompare',
  component: MetricCompare,
  args: {
    label: 'Error rate',
    canary: { label: 'Canary 25%', value: '0.21%', series: wave(0.2) },
    stable: { label: 'Stable', value: '0.19%', series: wave(0.19) },
    verdict: 'pass',
    verdictLabel: 'Within limits',
    emptyValue: 'No data',
  },
  decorators: [
    (Story) => <div className="max-w-90 rounded-card bg-card p-4 shadow-e1">{Story()}</div>,
  ],
} satisfies Meta<typeof MetricCompare>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithinLimits: Story = {};

export const WithinLimitsDark: Story = { globals: { mode: 'dark' } };

export const AboveStable: Story = {
  args: {
    canary: { label: 'Canary 25%', value: '1.9%', series: wave(0.2, 0.17) },
    verdict: 'fail',
    verdictLabel: 'Above stable',
  },
};

export const WaitingForSamples: Story = {
  args: {
    canary: { label: 'Canary 5%', value: null, series: [] },
    stable: { label: 'Stable', value: null, series: [] },
    verdict: 'pending',
    verdictLabel: 'Waiting for samples',
  },
};

/** What changed?'s chart: the 5xx rate with the changes marked, one just before the rise. */
export const ChangesOverErrorRate: StoryObj<typeof SeriesChart> = {
  render: () => (
    <SeriesChart
      tone="danger"
      height={150}
      points={Array.from({ length: 60 }, (_, i) => ({
        at: i,
        value: 0.22 + Math.sin(i / 4) * 0.03 + (i > 41 ? (i - 41) * 0.09 : 0),
      }))}
      markers={[
        { key: 'cart', at: 15, label: 'cart-api v8.2.1' },
        { key: 'pricing', at: 35, label: 'pricing-svc v2.18.0 us-east1', tone: 'warn' },
        { key: 'config', at: 46, label: 'checkout-api config' },
      ]}
      ariaLabel="5xx rate, up from 0.2% to 1.9% since 14:05"
    />
  ),
};

export const ConcurrentJobs: StoryObj<typeof SeriesChart> = {
  render: () => (
    <SeriesChart
      kind="bars"
      height={100}
      threshold={300}
      points={Array.from({ length: 48 }, (_, i) => ({
        at: i,
        value: 60 + 250 * Math.max(0, Math.sin(((i - 12) / 48) * Math.PI * 2)),
      }))}
      ariaLabel="Concurrent jobs, last 24 hours, peak 312"
    />
  ),
};
