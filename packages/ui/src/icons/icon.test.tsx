import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconButton } from '../components/button/icon-button.tsx';
import { Icon, ICON_NAMES, ICON_SIZE } from './icon.tsx';
import { formatPageIcon, isIconName, PageIcon, parsePageIcon } from './page-icon.tsx';

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

  it('draws every icon, chevrons included, with the 1.75px stroke', () => {
    const { container } = render(
      <>
        <Icon name="caret" />
        <Icon name="inbox" size={ICON_SIZE.bar} />
        <Icon name="zap" />
      </>,
    );
    // Lucide scales the stroke into its 24-unit viewBox so it draws at 1.75 screen pixels.
    const strokes = [...container.querySelectorAll('svg')].map(
      (svg) => (Number(svg.getAttribute('stroke-width')) * Number(svg.getAttribute('width'))) / 24,
    );
    expect(strokes).toEqual([1.75, 1.75, 1.75]);
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

describe('PageIcon', () => {
  it('reads a drawn icon with its tint, and never prints a name as text', () => {
    expect(parsePageIcon('flag:epic-3')).toEqual({ name: 'flag', tint: 'epic-3' });
    expect(parsePageIcon('flag')).toEqual({ name: 'flag', tint: null });
    expect(parsePageIcon('📝')).toBeNull();
    expect(isIconName('flag:epic-9')).toBe(false);
    expect(formatPageIcon('flag', 'epic-3')).toBe('flag:epic-3');
    const { container } = render(<PageIcon value="flag:epic-3" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('text-epic-3');
  });
});
