import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { RUN_GLYPH_STATES, RunGlyph } from './run-glyph.tsx';

/** Text a glyph draws besides its <title>: there must be none, every mark is a shape. */
const drawnText = (svg: Element) =>
  [...svg.childNodes]
    .filter((node) => node.nodeName !== 'title')
    .map((node) => node.textContent)
    .join('');

describe('RunGlyph', () => {
  it.each(RUN_GLYPH_STATES)('draws %s with shapes and token colours only', (state) => {
    const { container } = render(<RunGlyph state={state} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('data-state')).toBe(state);
    expect(drawnText(svg as Element)).toBe('');
    for (const el of svg?.querySelectorAll('[fill],[stroke]') ?? []) {
      for (const attr of ['fill', 'stroke']) {
        const value = el.getAttribute(attr);
        if (value && value !== 'none') expect(value).toMatch(/^var\(--[a-z0-9-]+\)$/);
      }
    }
  });

  it('names the state for assistive tech when given a label', async () => {
    const { container } = render(<RunGlyph state="failed" size={18} label="Failed" />);
    const svg = screen.getByRole('img', { name: 'Failed' });
    expect(svg.getAttribute('width')).toBe('18');
    await expectAccessible(container);
  });

  it('spins the running arc only behind motion-safe', () => {
    const { container } = render(<RunGlyph state="running" />);
    expect(container.querySelector('[data-part="arc"]')?.getAttribute('class')).toContain(
      'motion-safe:animate-spin',
    );
  });

  it('draws rolled back in amber, never failure red', () => {
    const { container } = render(<RunGlyph state="rolled_back" />);
    expect(container.querySelector('circle')?.getAttribute('fill')).toBe('var(--amber)');
  });
});
