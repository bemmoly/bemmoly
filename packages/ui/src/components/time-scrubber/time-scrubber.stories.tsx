import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TimeScrubber, type TimeScrubberBucket } from './time-scrubber.tsx';

const STEP = 15 * 60_000;
const END = Date.UTC(2026, 9, 16, 10, 45);

function buckets(count: number): TimeScrubberBucket[] {
  return Array.from({ length: count }, (_, index) => ({
    start: new Date(END - (count - index) * STEP).toISOString(),
    deploys: 10 + Math.round(24 * Math.abs(Math.sin(index / 9)) + ((index * 37) % 11)),
    incident: index === Math.round(count * 0.6) || index === Math.round(count * 0.86),
  }));
}

const time = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(
    new Date(iso),
  );

/** Holds the value, as the map screen does with ?at=. */
function Scrubber({ count, initial }: { count: number; initial: string | null }) {
  const [value, setValue] = useState<string | null>(initial);
  const list = buckets(count);
  const ticks = [0, 1, 2, 3].map((part) => Math.round((part * count) / 4));
  return (
    <div className="rounded-card bg-card px-3.5 py-2.5 shadow-e1">
      <TimeScrubber
        buckets={list}
        value={value}
        onChange={setValue}
        ariaLabel="Rewind the map"
        liveLabel="Live"
        formatTime={time}
        ticks={ticks}
        formatNow={(iso) => `Now ${time(iso)}`}
      />
    </div>
  );
}

const meta = {
  title: 'Pipelines/TimeScrubber',
  component: Scrubber,
  args: { count: 96, initial: null },
} satisfies Meta<typeof Scrubber>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Live: Story = {};

export const LiveDark: Story = { globals: { mode: 'dark' } };

export const Rewound: Story = {
  args: { initial: new Date(END - 30 * STEP).toISOString() },
};

export const RewoundDark: Story = {
  args: { initial: new Date(END - 30 * STEP).toISOString() },
  globals: { mode: 'dark' },
};

/** Seven days of 15-minute buckets: 672 bars, still one cheap element each. */
export const ManyBuckets: Story = { args: { count: 672 } };
