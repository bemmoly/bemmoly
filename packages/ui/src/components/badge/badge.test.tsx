import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { Badge } from './badge.tsx';

describe('Badge', () => {
  it('draws failure on the red tokens', async () => {
    const { container } = render(<Badge tone="danger">1 failed</Badge>);
    const badge = screen.getByText('1 failed');
    expect(badge.className).toContain('bg-red-50');
    expect(badge.className).toContain('text-red-tx');
    await expectAccessible(container);
  });

  it('keeps waiting on amber, not red', () => {
    render(<Badge tone="warn">1 waiting</Badge>);
    expect(screen.getByText('1 waiting').className).toContain('bg-amber-50');
  });
});
