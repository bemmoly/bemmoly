import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible, expectFocusRing } from '../testing/a11y.ts';
import { Button } from './button/index.ts';
import {
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPalette,
  CommandPlan,
} from './command-palette/index.ts';
import { Drawer, DrawerTitle } from './drawer/index.ts';
import { Dropdown, MenuGroup, MenuItem } from './menu/index.ts';
import { Modal } from './modal/index.ts';
import { Tabs } from './tabs/index.ts';
import { Toast, ToastProvider, useToast } from './toast/index.ts';
import { Tooltip } from './tooltip/index.ts';

describe('Modal and Drawer', () => {
  it('opens a labelled dialog and closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Modal
        open
        onClose={onClose}
        title="Delete project"
        footer={<Button variant="danger">Delete</Button>}
      >
        This removes 182 issues.
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Delete project' });
    await expectAccessible(dialog);
    act(() => {
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('docks the drawer beside content and closes it with Escape', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Drawer open onClose={onClose} label="PLT-204 details" header={<span>Auth service</span>}>
        <DrawerTitle>Session store migration to Postgres</DrawerTitle>
      </Drawer>,
    );
    await expectAccessible(container);
    const panel = screen.getByRole('complementary', { name: 'PLT-204 details' });
    expect(panel.className).toContain('w-100');
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Menu and Tabs', () => {
  it('opens from the keyboard, moves with arrows and returns focus on Escape', async () => {
    const onSelect = vi.fn();
    const { container } = render(
      <Dropdown label="Epic">
        <MenuGroup label="AI">
          <MenuItem onSelect={onSelect}>Continue writing</MenuItem>
          <MenuItem onSelect={() => {}}>Summarize</MenuItem>
        </MenuGroup>
      </Dropdown>,
    );
    const trigger = screen.getByRole('button', { name: 'Epic' });
    expectFocusRing(trigger);
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const items = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
    await expectAccessible(container);
    fireEvent.keyDown(items[0] as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1] as HTMLElement, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Continue writing' }));
    expect(onSelect).toHaveBeenCalled();
  });

  it('portals the menu to the body so a clipping card cannot hide it', () => {
    render(
      <div data-testid="card" className="overflow-hidden">
        <Dropdown label="Actions" align="end">
          <MenuItem onSelect={() => {}}>Deactivate</MenuItem>
        </Dropdown>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    const menu = screen.getByRole('menu');
    expect(menu.parentElement).toBe(document.body);
    expect(screen.getByTestId('card').contains(menu)).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Deactivate' }));
    fireEvent.pointerDown(screen.getByTestId('card'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('selects tabs with the arrow keys', async () => {
    function Harness() {
      const [tab, setTab] = useState<'columns' | 'lanes'>('columns');
      return (
        <Tabs
          aria-label="Board settings"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'columns', label: 'Columns' },
            { value: 'lanes', label: 'Swimlanes', badge: '2 locked' },
          ]}
        />
      );
    }
    const { container } = render(<Harness />);
    await expectAccessible(container);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Columns' }), { key: 'ArrowRight' });
    const lanes = screen.getByRole('tab', { name: /Swimlanes/ });
    expect(lanes.getAttribute('aria-selected')).toBe('true');
    expect(lanes.className).toContain('shadow-tab');
  });
});

describe('Toast and Tooltip', () => {
  it('shows a toast through the provider and dismisses it', async () => {
    function Harness() {
      const { show } = useToast();
      return (
        <Button onClick={() => show({ title: 'Saved', body: 'Everyone sees the new theme.' })}>
          Go
        </Button>
      );
    }
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByRole('status').textContent).toContain('Saved');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Saved')).toBeNull();
    const { container } = render(
      <Toast tone="ai" title="I drafted a reply" body="Review it before sending." />,
    );
    await expectAccessible(container);
  });

  it('describes its trigger on focus', () => {
    render(
      <Tooltip label="Open full page">
        <button type="button">Expand</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button');
    fireEvent.focus(button);
    expect(button.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id);
  });
});

describe('CommandPalette', () => {
  it('moves through results with the arrow keys and runs the active one on Enter', async () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <CommandPalette open onClose={() => {}}>
        <CommandInput value="auth" onValueChange={() => {}} />
        <CommandList>
          <CommandGroup label="Issues">
            <CommandItem issueKey="PLT-204" title="Session store migration" onSelect={first} />
            <CommandItem issueKey="PLT-218" title="Rotate service tokens" onSelect={second} />
          </CommandGroup>
        </CommandList>
        <CommandFooter />
      </CommandPalette>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Command palette' });
    await expectAccessible(dialog);
    const input = screen.getByRole('combobox');
    const options = screen.getAllByRole('option');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]?.id);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(second).toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
  });

  it('shows the plan with its permission verdicts and runs only allowed steps', () => {
    const onRun = vi.fn();
    render(
      <CommandPlan
        summary="Move the 2 issues blocked by PLT-204 to Sprint 15."
        steps={[
          { target: 'PLT-211', change: 'Session cleanup', field: 'Sprint', allowed: true },
          { target: 'PLT-219', change: 'Legacy cookie path', field: 'Sprint', allowed: false },
        ]}
        onRun={onRun}
      />,
    );
    expect(screen.getByText('DENIED')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Run 1 change/ }));
    expect(onRun).toHaveBeenCalled();
  });
});
