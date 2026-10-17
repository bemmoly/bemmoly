import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { StatTile } from './stat-tile.tsx';

describe('StatTile', () => {
  it('shows the label, the figure and its context in its tone', async () => {
    const { container } = render(
      <StatTile label="Queued" value="38" detail="oldest 2m 10s" detailTone="worse" />,
    );
    expect(screen.getByText('38')).toBeTruthy();
    expect(screen.getByText('oldest 2m 10s').className).toContain('text-amber-tx');
    await expectAccessible(container);
  });
});
