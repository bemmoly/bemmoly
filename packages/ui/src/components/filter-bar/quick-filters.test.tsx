import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible, expectFocusRing } from '../../testing/a11y.ts';
import { QuickFilters, splitQuickFilters, type QuickFilterToggle } from './quick-filters.tsx';

const make = (labels: string[], pressed: string[] = []): QuickFilterToggle[] =>
  labels.map((label) => ({
    id: label,
    label,
    pressed: pressed.includes(label),
    onToggle: vi.fn(),
  }));

describe('splitQuickFilters', () => {
  it('keeps the first ones in the row and the rest for "+N more"', () => {
    const { inline, more } = splitQuickFilters(make(['a', 'b', 'c', 'd', 'e']), 3);
    expect(inline.map((f) => f.id)).toEqual(['a', 'b', 'c']);
    expect(more.map((f) => f.id)).toEqual(['d', 'e']);
  });

  it('always shows a filter that is on, even past the limit', () => {
    const { inline, more } = splitQuickFilters(make(['a', 'b', 'c', 'd'], ['d']), 2);
    expect(inline.map((f) => f.id)).toEqual(['a', 'd']);
    expect(more.map((f) => f.id)).toEqual(['b', 'c']);
  });
});

describe('QuickFilters', () => {
  it('draws pressed toggles and hands the overflow to a menu', async () => {
    const filters = make(['Only my issues', 'Recently updated', 'Blocked', 'Bugs'], ['Blocked']);
    const { container } = render(<QuickFilters filters={filters} maxVisible={2} />);
    await expectAccessible(container);
    const blocked = screen.getByRole('button', { name: 'Blocked' });
    expect(blocked.getAttribute('aria-pressed')).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Only my issues' }).getAttribute('aria-pressed'),
    ).toBe('false');
    expectFocusRing(blocked);
    fireEvent.click(blocked);
    expect(filters[2]!.onToggle).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: '2 more quick filters' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Bugs' }));
    expect(filters[3]!.onToggle).toHaveBeenCalledOnce();
  });

  it('draws nothing without filters', () => {
    const { container } = render(<QuickFilters filters={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
