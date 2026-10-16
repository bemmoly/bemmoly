import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { highlight, type LogViewLine } from './log-line.tsx';
import { LogView } from './log-view.tsx';

const line = (number: number, error = false): LogViewLine => ({
  number,
  text: `line ${number} PASS`,
  spans: [
    { text: `line ${number} `, kind: 'dim' },
    { text: 'PASS', kind: 'success' },
  ],
  error,
});

const lineLabel = (n: number) => `Line ${n}`;

describe('LogView', () => {
  let rect: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    // jsdom lays nothing out; give the scroller a height so the virtualiser draws rows.
    rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 800,
      height: 200,
      top: 0,
      left: 0,
      bottom: 200,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
  });
  afterEach(() => {
    rect.mockRestore();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('draws only the rows in view of a long log, named and accessible', async () => {
    const { container } = render(
      <LogView
        totalLines={100_000}
        getLine={(n) => line(n, n === 3)}
        follow={false}
        ariaLabel="Log of Unit 2 of 3"
        lineLabel={lineLabel}
        selectedLine={2}
      />,
    );
    const region = screen.getByRole('region', { name: 'Log of Unit 2 of 3' });
    expect(region.tabIndex).toBe(0);
    const rows = screen.getAllByRole('listitem');
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.length).toBeLessThan(100);
    expect(rows[0]?.getAttribute('aria-setsize')).toBe('100000');
    expect(container.querySelector('[data-line="3"]')?.className).toContain('bg-red-50');
    expect(container.querySelector('[data-line="2"]')?.className).toContain('bg-acc-50');
    await expectAccessible(container);
  });

  it('links a line from its number and asks for lines it has not loaded', () => {
    vi.useFakeTimers();
    const onSelectLine = vi.fn();
    const onRangeNeeded = vi.fn();
    render(
      <LogView
        totalLines={500}
        getLine={(n) => (n < 5 ? line(n) : undefined)}
        onRangeNeeded={onRangeNeeded}
        follow={false}
        ariaLabel="Log"
        lineLabel={lineLabel}
        onSelectLine={onSelectLine}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Line 4' }));
    expect(onSelectLine).toHaveBeenCalledWith(4);
    act(() => vi.advanceTimersByTime(100));
    expect(onRangeNeeded).toHaveBeenCalledWith(1, expect.any(Number));
  });

  it('stops following when scrolled up by hand', () => {
    const onFollowChange = vi.fn();
    render(
      <LogView
        totalLines={500}
        getLine={line}
        follow
        onFollowChange={onFollowChange}
        ariaLabel="Log"
        lineLabel={lineLabel}
      />,
    );
    const region = screen.getByRole('region');
    Object.defineProperty(region, 'scrollHeight', { value: 10_000, configurable: true });
    Object.defineProperty(region, 'clientHeight', { value: 200, configurable: true });
    region.scrollTop = 9_800;
    fireEvent.scroll(region);
    region.scrollTop = 4_000;
    fireEvent.scroll(region);
    expect(onFollowChange).toHaveBeenCalledWith(false);
  });
});

describe('highlight', () => {
  it('cuts spans at hit boundaries and keeps each side its kind', () => {
    const { container } = render(<div>{highlight(line(12).spans, [[5, 11]], true)}</div>);
    const marks = [...container.querySelectorAll('mark')].map((m) => m.textContent);
    expect(marks).toEqual(['12 ', 'PAS']);
    expect(container.querySelector('mark')?.className).toContain('ring-amber');
    expect(container.textContent).toBe('line 12 PASS');
    expect(container.querySelectorAll('.text-green-tx').length).toBe(2);
  });
});
