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
});
