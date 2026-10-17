import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { FacetPanel } from './facet-panel.tsx';

const teams = Array.from({ length: 8 }, (_, index) => ({
  value: `t${index}`,
  label: `Team ${index}`,
  count: 8 - index,
}));

describe('FacetPanel', () => {
  it('lists values with counts, toggles one and folds a long facet', async () => {
    const onToggle = vi.fn();
    const { container } = render(
      <FacetPanel
        ariaLabel="Filters"
        showAllLabel={(count) => `Show all ${count}`}
        showFewerLabel="Show fewer"
        onToggle={onToggle}
        groups={[
          {
            key: 'tier',
            label: 'Tier',
            selected: ['0'],
            options: [
              { value: '0', label: 'Tier 0', count: 41 },
              { value: '1', label: 'Tier 1', count: 0 },
            ],
          },
          { key: 'team', label: 'Owner team', selected: ['t7'], options: teams, limit: 3 },
        ]}
      />,
    );
    await expectAccessible(container);
    expect((screen.getByRole('checkbox', { name: /Tier 0/ }) as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Tier 1/ }));
    expect(onToggle).toHaveBeenCalledWith('tier', '1');
    // Three on top, plus the chosen one that sits further down.
    expect(screen.getAllByRole('checkbox', { name: /Team/ })).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 8' }));
    expect(screen.getAllByRole('checkbox', { name: /Team/ })).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Show fewer' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });
});
