import { act, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../testing/a11y.ts';
import { StartGuide } from './empty-state/index.ts';
import { MenuItem } from './menu/index.ts';
import { PageTree, type PageTreeItem, type PageTreeMove } from './page-tree/index.ts';
import { SpaceSwitcher } from './space-card/index.ts';
import { TemplatePicker } from './template-card/index.ts';

const base: PageTreeItem[] = [
  { id: 'a', parentId: null, depth: 0, title: 'Onboarding', hasChildren: false },
  { id: 'b', parentId: null, depth: 0, title: 'Architecture', hasChildren: true, expanded: true },
  { id: 'b1', parentId: 'b', depth: 1, title: 'Services map', hasChildren: false },
  { id: 'c', parentId: null, depth: 0, title: 'Runbooks', hasChildren: true },
];

function Harness(props: {
  onMove?: (move: PageTreeMove) => void;
  onOpen?: (id: string) => void;
  onRename?: (title: string) => void;
}) {
  const [items, setItems] = useState(base);
  const [renaming, setRenaming] = useState<string | null>(null);
  const shown = items.filter(
    (row) => !row.parentId || items.find((parent) => parent.id === row.parentId)?.expanded,
  );
  return (
    <PageTree
      label="Pages in Engineering"
      items={shown}
      activeId="b1"
      hrefOf={(item) => `/docs/p/${item.id}`}
      onOpen={(item) => props.onOpen?.(item.id)}
      onToggle={(item, expanded) =>
        setItems((rows) => rows.map((row) => (row.id === item.id ? { ...row, expanded } : row)))
      }
      {...(props.onMove ? { onMove: props.onMove } : {})}
      onAddChild={() => undefined}
      menu={() => <MenuItem onSelect={() => undefined}>Rename</MenuItem>}
      renamingId={renaming}
      onRenameStart={(item) => setRenaming(item.id)}
      onRename={(_item, title) => {
        props.onRename?.(title);
        setRenaming(null);
      }}
      onRenameCancel={() => setRenaming(null)}
    />
  );
}

describe('PageTree', () => {
  it('is an accessible tree with the open page current', async () => {
    render(<Harness />);
    const tree = screen.getByRole('tree', { name: 'Pages in Engineering' });
    await expectAccessible(tree);
    const current = screen.getByRole('treeitem', { name: /Services map/ });
    expect(current?.getAttribute('aria-selected')).toBe('true');
    expect(current?.getAttribute('aria-level')).toBe('2');
    expect(current?.getAttribute('tabindex')).toBe('0');
    expect(
      screen.getByRole('treeitem', { name: /Architecture/ })?.getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('walks, opens and closes rows with the arrow keys', () => {
    const onOpen = vi.fn();
    render(<Harness onOpen={onOpen} />);
    const services = screen.getByRole('treeitem', { name: /Services map/ });
    act(() => services.focus());
    fireEvent.keyDown(services, { key: 'ArrowLeft' });
    const architecture = screen.getByRole('treeitem', { name: /Architecture/ });
    expect(document.activeElement).toBe(architecture);
    fireEvent.keyDown(architecture, { key: 'ArrowLeft' });
    expect(architecture?.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('treeitem', { name: /Services map/ })).toBeNull();
    fireEvent.keyDown(architecture, { key: 'ArrowDown' });
    const runbooks = screen.getByRole('treeitem', { name: /Runbooks/ });
    expect(document.activeElement).toBe(runbooks);
    fireEvent.keyDown(runbooks, { key: 'o' });
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /Onboarding/ }));
    fireEvent.keyDown(screen.getByRole('treeitem', { name: /Onboarding/ }), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith('a');
  });

  it('moves a page with Alt+arrows', () => {
    const onMove = vi.fn();
    render(<Harness onMove={onMove} />);
    const runbooks = screen.getByRole('treeitem', { name: /Runbooks/ });
    fireEvent.keyDown(runbooks, { key: 'ArrowUp', altKey: true });
    expect(onMove).toHaveBeenCalledWith({ id: 'c', parentId: null, afterId: 'a', beforeId: 'b' });
  });

  it('renames in place with F2', () => {
    const onRename = vi.fn();
    render(<Harness onRename={onRename} />);
    fireEvent.keyDown(screen.getByRole('treeitem', { name: /Onboarding/ }), { key: 'F2' });
    const input = screen.getByRole('textbox', { name: 'Page title' });
    fireEvent.change(input, { target: { value: 'Welcome' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('Welcome');
  });

  it('draws a drop line and moves on drop', () => {
    const onMove = vi.fn();
    render(<Harness onMove={onMove} />);
    const onboarding = screen.getByRole('treeitem', { name: /Onboarding/ });
    const runbooks = screen.getByRole('treeitem', { name: /Runbooks/ });
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? '',
      effectAllowed: 'move',
      dropEffect: 'move',
    };
    runbooks.getBoundingClientRect = () => ({ top: 100, height: 30 }) as DOMRect;
    fireEvent.dragStart(onboarding, { dataTransfer });
    const at = (event: Event) => {
      Object.defineProperty(event, 'clientY', { value: 128 });
      return event;
    };
    fireEvent(runbooks, at(createEvent.dragOver(runbooks, { dataTransfer })));
    expect(runbooks.querySelector('[data-drop-line="after"]')).not.toBeNull();
    fireEvent(runbooks, at(createEvent.drop(runbooks, { dataTransfer })));
    expect(onMove).toHaveBeenCalledWith({ id: 'a', parentId: null, afterId: 'c', beforeId: null });
  });
});

describe('Docs navigation pieces', () => {
  it('switch spaces from the sidebar head', () => {
    const onSelect = vi.fn();
    const eng = { id: '1', key: 'ENG', name: 'Engineering', tone: 'accent' as const };
    const ops = { id: '2', key: 'OPS', name: 'Operations', tone: 'slate' as const };
    render(
      <SpaceSwitcher current={eng} meta="184 pages" spaces={[eng, ops]} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Engineering, switch space' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Operations/ }));
    expect(onSelect).toHaveBeenCalledWith(ops);
  });

  it('pick a template, blank first, grouped by category', async () => {
    const onSelect = vi.fn();
    const onChoose = vi.fn();
    const { container } = render(
      <TemplatePicker
        selectedId="t1"
        onSelect={onSelect}
        onChoose={onChoose}
        templates={[
          { id: 't1', name: 'RFC', description: 'A design doc', category: 'Engineering' },
          { id: 't2', name: 'Notes' },
        ]}
      />,
    );
    await expectAccessible(container);
    expect(screen.getByRole('region', { name: 'Engineering' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'General' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Blank page/ }));
    expect(onSelect).toHaveBeenCalledWith(null);
    fireEvent.keyDown(screen.getByRole('button', { name: /RFC/ }), { key: 'Enter' });
    expect(onChoose).toHaveBeenCalledWith('t1');
  });

  it('guide a first run, marking the next step', async () => {
    const { container } = render(
      <StartGuide
        title="Welcome to Docs"
        steps={[
          { title: 'Create a space', description: 'A home for a team.', done: true },
          { title: 'Write a page', description: 'Start from a template.' },
        ]}
      />,
    );
    await expectAccessible(container);
    expect(screen.getByText('Write a page').closest('li')?.getAttribute('aria-current')).toBe(
      'step',
    );
    expect(screen.getByText('(done)')).toBeTruthy();
  });
});
