import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { Lane } from './lane.tsx';

describe('Lane', () => {
  it('draws one decorative dot per moving release, read as its label', async () => {
    const { container } = render(
      <Lane
        label="2 moving, 1 failed"
        dots={[
          { id: 'a', state: 'running', position: 0.2 },
          { id: 'b', state: 'running', position: 0.6 },
          { id: 'c', state: 'failed', position: 0.4 },
        ]}
      />,
    );
    const dots = container.querySelectorAll('[data-state]');
    expect(dots).toHaveLength(3);
    for (const dot of dots) expect(dot.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('2 moving, 1 failed').className).toContain('sr-only');
    await expectAccessible(container);
  });

  it('drifts running dots behind motion-safe only and holds the others still', () => {
    const { container } = render(
      <Lane
        dots={[
          { id: 'r', state: 'running', position: 0.3 },
          { id: 'w', state: 'waiting', position: 0.3 },
          { id: 'f', state: 'failed', position: 0.3 },
        ]}
      />,
    );
    const layer = (state: string) =>
      container.querySelector(`[data-state="${state}"]`) as HTMLElement;
    expect(layer('running').className).toContain('motion-safe:animate-drift');
    expect(layer('running').style.getPropertyValue('--drift-x')).toBe('18.0%');
    expect(layer('waiting').className).not.toContain('animate');
    expect(layer('failed').className).not.toContain('animate');
  });

  it('never carries a dot past the end of the lane', () => {
    const { container } = render(<Lane dots={[{ id: 'r', state: 'running', position: 1.4 }]} />);
    const layer = container.querySelector('[data-state="running"]') as HTMLElement;
    expect(layer.className).not.toContain('animate');
    expect((layer.firstElementChild as HTMLElement).style.left).toBe('calc(100% - 8px)');
  });
});
