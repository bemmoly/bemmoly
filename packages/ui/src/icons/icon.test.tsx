import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconButton } from '../components/button/icon-button.tsx';
import { Icon, ICON_NAMES, ICON_SIZE } from './icon.tsx';

describe('Icon', () => {
  it('draws every name as an SVG that inherits the text colour', () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg, name).not.toBeNull();
      expect(svg?.getAttribute('stroke'), name).toBe('currentColor');
      unmount();
    }
  });

  it('keeps the names other screens use', () => {
    for (const name of ['key', 'server', 'table', 'inbox', 'settings', 'caret', 'help'] as const)
      expect(ICON_NAMES).toContain(name);
  });

  it('is 16px by default, carets included, and takes an explicit size', () => {
    const { container } = render(
      <>
        <Icon name="inbox" />
        <Icon name="caret" />
        <Icon name="theme" size={ICON_SIZE.bar} />
        <Icon name="caret" size={ICON_SIZE.small} />
      </>,
    );
    const sizes = [...container.querySelectorAll('svg')].map((svg) => svg.getAttribute('width'));
    expect(sizes).toEqual(['16', '16', '18', '14']);
  });

  it('draws chevrons a little heavier than other icons', () => {
    const { container } = render(
      <>
        <Icon name="caret" />
        <Icon name="inbox" />
      </>,
    );
    const strokes = [...container.querySelectorAll('svg')].map((svg) =>
      Number(svg.getAttribute('stroke-width')),
    );
    expect(strokes[0]).toBeGreaterThan(strokes[1] ?? 0);
  });

  it('is hidden from assistive tech unless it has a label', () => {
    const { container } = render(
      <>
        <Icon name="search" />
        <Icon name="help" label="Help" />
      </>,
    );
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('img', { name: 'Help' })).toBeDefined();
  });

  it('gives an icon button its name from the label, not the drawing', () => {
    render(<IconButton label="Inbox" icon="inbox" badge={4} />);
    expect(screen.getByRole('button', { name: 'Inbox, 4' })).toBeDefined();
  });
});
