import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { DeployCell } from './deploy-cell.tsx';

describe('DeployCell', () => {
  it('reads as its label and draws the count, the quiet words and the flags', async () => {
    const { container } = render(
      <DeployCell
        count="210"
        secondary="2 moving"
        dots={[{ id: 'a', state: 'running', position: 0.4 }]}
        flags={[{ tone: 'danger', text: '1 failed' }]}
        label="Staging: 210 applications, 2 moving, 1 failed"
      />,
    );
    expect(screen.getByText('Staging: 210 applications, 2 moving, 1 failed').className).toContain(
      'sr-only',
    );
    expect(screen.getByText('210').parentElement?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('1 failed').className).toContain('bg-red-50');
    await expectAccessible(container);
  });

  it('draws at most two flags', () => {
    render(
      <DeployCell
        count="58"
        dots={[]}
        label="Prod"
        flags={[
          { tone: 'warn', text: 'rolled back 09:12' },
          { tone: 'accent', text: 'train 11:00' },
          { tone: 'danger', text: '1 failed' },
        ]}
      />,
    );
    expect(screen.getByText('train 11:00').className).toContain('bg-acc-50');
    expect(screen.queryByText('1 failed')).toBeNull();
  });

  it('holds its dots still while rewound', () => {
    const { container } = render(
      <DeployCell
        still
        count="9"
        dots={[{ id: 'r', state: 'running', position: 0.2 }]}
        label="Build"
      />,
    );
    expect(container.querySelector('[data-state="running"]')?.className).not.toContain('animate');
  });
});
