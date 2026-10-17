import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { TimeScrubber, type TimeScrubberBucket } from './time-scrubber.tsx';

const STEP = 15 * 60_000;
const BUCKETS: TimeScrubberBucket[] = Array.from({ length: 96 }, (_, index) => ({
  start: new Date(Date.UTC(2026, 9, 16, 11) + index * STEP).toISOString(),
  deploys: (index * 7) % 23,
  incident: index === 58,
}));

function setup(value: string | null) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  const view = render(
    <TimeScrubber
      buckets={BUCKETS}
      value={value}
      onChange={onChange}
      onCommit={onCommit}
      ariaLabel="Rewind the map"
      liveLabel="Live"
      formatTime={(iso) => iso.slice(11, 16)}
      ticks={[0, 24, 48, 72]}
      formatNow={(iso) => `Now ${iso.slice(11, 16)}`}
    />,
  );
  return { ...view, onChange, onCommit, slider: screen.getByRole('slider') };
}

describe('TimeScrubber', () => {
  it('is a named slider that reads Live at the end', async () => {
    const { container, slider } = setup(null);
    expect(slider.getAttribute('aria-label')).toBe('Rewind the map');
    expect(slider.getAttribute('aria-valuetext')).toBe('Live');
    expect(slider.getAttribute('aria-valuenow')).toBe(slider.getAttribute('aria-valuemax'));
    expect(screen.getByText('Now 11:00')).toBeTruthy();
    await expectAccessible(container);
  });

  it('draws incidents in red and dims what has not happened yet while rewound', () => {
    const { container } = setup(BUCKETS[40]?.start ?? null);
    const bars = container.querySelectorAll('[data-part="track"] > span');
    expect(bars).toHaveLength(96);
    expect(bars[58]?.className).toContain('bg-red');
    expect(bars[39]?.className).not.toContain('opacity-35');
    expect(bars[41]?.className).toContain('opacity-35');
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('21:00');
  });

  it('steps a bucket with the arrows, an hour with Shift, and End returns to live', () => {
    const { slider, onChange, onCommit } = setup(BUCKETS[40]?.start ?? null);
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onCommit).toHaveBeenLastCalledWith(BUCKETS[39]?.start);
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true });
    expect(onCommit).toHaveBeenLastCalledWith(BUCKETS[44]?.start);
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onCommit).toHaveBeenLastCalledWith(BUCKETS[0]?.start);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('steps back from live into the newest bucket', () => {
    const { slider, onCommit } = setup(null);
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onCommit).toHaveBeenLastCalledWith(BUCKETS[95]?.start);
  });

  it('handles a week of buckets', () => {
    const week = Array.from({ length: 672 }, (_, index) => ({
      start: new Date(Date.UTC(2026, 9, 9) + index * STEP).toISOString(),
      deploys: index % 30,
      incident: false,
    }));
    const { container } = render(
      <TimeScrubber
        buckets={week}
        value={null}
        onChange={() => undefined}
        ariaLabel="Rewind the map"
        liveLabel="Live"
        formatTime={(iso) => iso}
      />,
    );
    expect(container.querySelectorAll('[data-part="track"] > span')).toHaveLength(672);
  });
});
