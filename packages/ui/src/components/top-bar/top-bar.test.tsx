import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { MenuItem } from '../menu/menu-item.tsx';
import { CreateMenuEmpty, CreateMenuItem } from './create-menu.tsx';
import { TopBar } from './top-bar.tsx';

const user = { name: 'Rohan S.' };

describe('TopBar', () => {
  it('shows the caret only on items that open a menu', () => {
    render(
      <TopBar
        user={user}
        nav={[
          { id: 'work', label: 'Your work', href: '#work' },
          { id: 'teams', label: 'Teams', menu: <MenuItem onSelect={() => {}}>Platform</MenuItem> },
        ]}
      />,
    );
    const plain = screen.getByRole('link', { name: 'Your work' });
    expect(plain.querySelector('svg')).toBeNull();
    const withMenu = screen.getByRole('button', { name: 'Teams' });
    expect(withMenu.querySelector('svg')).not.toBeNull();
    fireEvent.click(withMenu);
    expect(screen.getByRole('menuitem', { name: 'Platform' })).toBeDefined();
  });

  it('opens a readable Create menu and runs the chosen item', async () => {
    const onSelect = vi.fn();
    const { container } = render(
      <TopBar
        user={user}
        nav={[]}
        createMenu={
          <CreateMenuItem
            icon="board"
            label="Issue"
            description="A bug, story or task in a project"
            shortcut="Mod+N"
            onSelect={onSelect}
          />
        }
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    const item = screen.getByRole('menuitem', { name: /Issue/ });
    expect(item.textContent).toContain('A bug, story or task in a project');
    // Keys are drawn as icons and words; assistive tech hears them spelled out.
    expect(item.textContent).toContain('Control N');
    await expectAccessible(container);
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('explains an empty Create menu and offers the next step', () => {
    const onModules = vi.fn();
    render(
      <TopBar
        user={user}
        nav={[]}
        createMenu={
          <CreateMenuEmpty
            title="Nothing to create yet"
            description="Create fills up once a module is enabled."
            action={<MenuItem onSelect={onModules}>Open Settings › Modules</MenuItem>}
          />
        }
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText('Nothing to create yet')).toBeDefined();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open Settings › Modules' }));
    expect(onModules).toHaveBeenCalledOnce();
  });
});
