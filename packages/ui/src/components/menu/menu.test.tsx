import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Menu } from './menu.tsx';
import { MenuItem } from './menu-item.tsx';

describe('Menu', () => {
  it('returns focus to its trigger when an item is chosen', () => {
    const onSelect = vi.fn();
    render(
      <Menu
        trigger={(props) => (
          <button type="button" {...props}>
            Actions
          </button>
        )}
      >
        <MenuItem onSelect={onSelect}>Archive</MenuItem>
      </Menu>,
    );
    const trigger = screen.getByRole('button', { name: 'Actions' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Archive' }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
  });

  it('toggles a checkbox item in place and reaches it with the arrow keys', () => {
    const onSelect = vi.fn();
    render(
      <Menu
        trigger={(props) => (
          <button type="button" {...props}>
            Display
          </button>
        )}
      >
        <MenuItem onSelect={() => undefined}>Reset</MenuItem>
        <MenuItem kind="checkbox" checked={false} keepOpen onSelect={onSelect}>
          Labels
        </MenuItem>
      </Menu>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Display' }));
    const item = screen.getByRole('menuitemcheckbox', { name: 'Labels' });
    expect(item.getAttribute('aria-checked')).toBe('false');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item);
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Labels' })).toBeTruthy();
  });
});
