import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible, expectFocusRing } from '../../testing/a11y.ts';
import { DependencyLines, dependencyPath } from './dependency-lines.tsx';
import { ForecastChip, forecastWords } from './forecast-chip.tsx';
import { dayOfIso, isoOfDay, shortDate, timelineScale, timelineTicks, weekStart } from './scale.ts';
import { TimelineBar } from './timeline-bar.tsx';
import { TimelineGrid, TimelineHeader } from './timeline-header.tsx';

const day = dayOfIso;

describe('timeline scale', () => {
  it('turns dates into days and back without a time zone', () => {
    expect(isoOfDay(day('2026-10-21'))).toBe('2026-10-21');
    expect(shortDate(day('2026-10-21'), 2026)).toBe('Oct 21');
    expect(shortDate(day('2027-01-15'), 2026)).toBe('Jan 15, 2027');
    expect(isoOfDay(weekStart(day('2026-10-08')))).toBe('2026-10-05');
    expect(isoOfDay(weekStart(day('2026-10-05')))).toBe('2026-10-05');
  });

  it('widens to whole months and maps days to pixels both ways', () => {
    const scale = timelineScale('months', day('2026-09-15'), day('2026-10-20'));
    expect(isoOfDay(scale.from)).toBe('2026-09-01');
    expect(isoOfDay(scale.to)).toBe('2026-10-31');
    expect(scale.width).toBe(61 * 6);
    expect(scale.x(day('2026-09-02'))).toBe(6);
    expect(isoOfDay(scale.dayAt(13))).toBe('2026-09-03');
  });

  it('names months over weeks, and quarters over months when zoomed out', () => {
    const weeks = timelineTicks(timelineScale('weeks', day('2026-10-01'), day('2026-10-31')));
    expect(weeks.major.map((tick) => tick.label)).toEqual(['Oct 2026']);
    expect(weeks.minor.map((tick) => tick.label)).toEqual(['28', '5', '12', '19', '26']);
    expect(weeks.minor[0]?.width).toBe(4 * 24);
    const quarters = timelineTicks(timelineScale('quarters', day('2026-11-01'), day('2027-02-01')));
    expect(quarters.major.map((tick) => tick.label)).toEqual(['Q4 2026', 'Q1 2027']);
    expect(quarters.minor.map((tick) => tick.label)).toEqual([
      'Oct',
      'Nov',
      'Dec',
      'Jan',
      'Feb',
      'Mar',
    ]);
  });
});

describe('timeline parts', () => {
  const scale = timelineScale('months', day('2026-09-01'), day('2026-12-31'));
  const today = day('2026-10-05');

  it('draws the header with today and stays accessible', async () => {
    const { container } = render(
      <div className="relative">
        <TimelineHeader scale={scale} today={today} />
        <TimelineGrid scale={scale} today={today} />
      </div>,
    );
    expect(screen.getByRole('list', { name: 'Dates' }).textContent).toContain('Sep 2026');
    expect(screen.getByText('Today')).toBeTruthy();
    await expectAccessible(container);
  });

  it('is one named button that reports its grips and keys', async () => {
    const onGrab = vi.fn();
    const onKeyDown = vi.fn();
    const { container } = render(
      <div className="relative h-11">
        <TimelineBar
          left={scale.x(day('2026-09-22'))}
          width={30 * 6}
          tone="epic-2"
          label="Billing v2"
          progress={34}
          late={{ width: 66, label: 'Forecast Nov 1' }}
          range={{ from: 200, likely: 240, to: 280, warn: true }}
          movable
          aria-label="Billing v2, Sep 22 to Oct 21, 34% done"
          aria-keyshortcuts="ArrowLeft ArrowRight"
          onGrab={onGrab}
          onKeyDown={onKeyDown}
        />
      </div>,
    );
    const bar = screen.getByRole('button', { name: 'Billing v2, Sep 22 to Oct 21, 34% done' });
    expectFocusRing(bar);
    expect(bar.textContent).toBe('Billing v2 · 34%');
    fireEvent.pointerDown(bar, { button: 0 });
    expect(onGrab).toHaveBeenLastCalledWith('move', expect.anything());
    const end = container.querySelector('[data-grip="end"]');
    if (!end) throw new Error('no end grip');
    fireEvent.pointerDown(end, { button: 0 });
    expect(onGrab).toHaveBeenLastCalledWith('end', expect.anything());
    fireEvent.keyDown(bar, { key: 'ArrowRight' });
    expect(onKeyDown).toHaveBeenCalled();
    await expectAccessible(container);
  });

  it('puts a short bar’s name beside it and has no grips when it cannot move', () => {
    const { container } = render(
      <div className="relative h-11">
        <TimelineBar left={10} width={20} tone="neutral" label="1.0" milestone aria-label="1.0" />
      </div>,
    );
    expect(container.querySelector('[data-grip]')).toBeNull();
    expect(screen.getByText('1.0')).toBeTruthy();
  });

  it('says a forecast in words, as a button when it opens one', async () => {
    const onClick = vi.fn();
    const { container } = render(
      <div>
        <ForecastChip state="late" daysLate={11} label="Billing v2 forecast" onClick={onClick} />
        <ForecastChip state="on_track" />
        <ForecastChip state="done" />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Billing v2 forecast: 11 days late' }));
    expect(onClick).toHaveBeenCalled();
    expect(forecastWords('no_forecast')).toBe('Too early to tell');
    expect(forecastWords('late', 1)).toBe('1 day late');
    await expectAccessible(container);
  });

  it('draws dependencies as elbows, round the blocker when the plan conflicts', () => {
    expect(
      dependencyPath({ id: 'a', from: { x: 100, y: 22 }, to: { x: 160, y: 66 }, conflict: false }),
    ).toBe('M 100 22 H 130 V 66 H 160');
    expect(
      dependencyPath({ id: 'b', from: { x: 100, y: 22 }, to: { x: 60, y: 66 }, conflict: true }),
    ).toBe('M 100 22 H 108 V 36 H 52 V 66 H 60');
    const { container } = render(
      <DependencyLines
        width={300}
        height={100}
        lines={[{ id: 'a', from: { x: 100, y: 22 }, to: { x: 160, y: 66 }, conflict: false }]}
      />,
    );
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
