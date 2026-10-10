import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatAbsolute } from '../lib/time.ts';
import { expectAccessible } from '../testing/a11y.ts';
import { RelativeTime } from './relative-time/relative-time.tsx';
import { SkeletonCard, SkeletonHeader, SkeletonRow } from './skeleton/skeleton-shapes.tsx';

describe('RelativeTime', () => {
  it('prints the relative time and carries the absolute one', async () => {
    const iso = '2026-10-10T09:30:00Z';
    const { container } = render(<RelativeTime iso={iso} now={new Date('2026-10-10T12:45:00Z')} />);
    const time = container.querySelector('time') as HTMLTimeElement;
    expect(time.getAttribute('dateTime')).toBe(iso);
    expect(time.getAttribute('title')).toBe(formatAbsolute(iso));
    expect(time.textContent).toContain('3h ago');
    expect(time.textContent).toContain(formatAbsolute(iso));
    await expectAccessible(container);
  });
});

describe('Skeleton shapes', () => {
  it('match the final layout heights and stay hidden from assistive tech', () => {
    const { container } = render(
      <>
        <SkeletonHeader tabs={3} />
        <SkeletonRow />
        <SkeletonCard />
      </>,
    );
    const [header, row, card] = [...container.children];
    expect(header?.className).toContain('h-13');
    expect(row?.className).toContain('h-9');
    expect(card?.className).toContain('rounded-card');
    for (const el of [header, row, card]) expect(el?.getAttribute('aria-hidden')).toBe('true');
  });
});
