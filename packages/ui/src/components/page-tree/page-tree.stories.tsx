import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { SearchInput } from '../input/index.ts';
import { MenuItem, MenuSeparator } from '../menu/menu-item.tsx';
import { SpaceSwitcher } from '../space-card/space-switcher.tsx';
import { PageTree } from './page-tree.tsx';
import type { PageTreeItem, PageTreeMove } from './tree-model.ts';

interface Node {
  id: string;
  title: string;
  children?: Node[];
}

/** The Doc Editor mock's Engineering tree. */
const ENGINEERING: Node[] = [
  { id: 'onb', title: 'Onboarding', children: [{ id: 'onb1', title: 'First week' }] },
  {
    id: 'arch',
    title: 'Architecture',
    children: [
      { id: 'map', title: 'Services map' },
      { id: 'rfc', title: 'Auth service RFC' },
      { id: 'ret', title: 'Data retention' },
      { id: 'bus', title: 'Event bus design' },
    ],
  },
  { id: 'run', title: 'Runbooks', children: [{ id: 'run1', title: 'Session migration runbook' }] },
  { id: 'pm', title: 'Postmortems', children: [{ id: 'pm1', title: 'Sep 29 login outage' }] },
  { id: 'sec', title: 'Security', children: [{ id: 'sec1', title: 'Threat model' }] },
  { id: 'dec', title: 'Decision log' },
];

function flatten(nodes: Node[], open: Set<string>, parentId: string | null = null, depth = 0) {
  return nodes.flatMap((node): PageTreeItem[] => {
    const kids = node.children ?? [];
    const expanded = open.has(node.id);
    const row = {
      id: node.id,
      parentId,
      depth,
      title: node.title,
      hasChildren: kids.length > 0,
      expanded,
    };
    return [row, ...(expanded ? flatten(kids, open, node.id, depth + 1) : [])];
  });
}

function take(nodes: Node[], id: string): [Node | null, Node[]] {
  let found: Node | null = null;
  const rest = nodes
    .filter((node) => (node.id === id ? ((found = node), false) : true))
    .map((node) => {
      if (found || !node.children) return node;
      const [inner, children] = take(node.children, id);
      if (inner) found = inner;
      return { ...node, children };
    });
  return [found, rest];
}

function place(nodes: Node[], node: Node, move: PageTreeMove): Node[] {
  const insert = (list: Node[]) => {
    const at = move.beforeId
      ? list.findIndex((item) => item.id === move.beforeId)
      : move.afterId
        ? list.findIndex((item) => item.id === move.afterId) + 1
        : list.length;
    return [...list.slice(0, at), node, ...list.slice(at)];
  };
  if (move.parentId === null) return insert(nodes);
  return nodes.map((item) =>
    item.id === move.parentId
      ? { ...item, children: insert(item.children ?? []) }
      : { ...item, children: item.children ? place(item.children, node, move) : undefined },
  ) as Node[];
}

function Sidebar() {
  const [nodes, setNodes] = useState(ENGINEERING);
  const [open, setOpen] = useState(new Set(['arch']));
  const [active, setActive] = useState('rfc');
  const [renaming, setRenaming] = useState<string | null>(null);
  const items = useMemo(() => flatten(nodes, open), [nodes, open]);
  const eng = { id: '1', key: 'ENG', name: 'Engineering', tone: 'accent' as const };
  return (
    <aside className="flex h-180 w-65 flex-col border-r border-br bg-sf">
      <SpaceSwitcher
        current={eng}
        meta="184 pages"
        spaces={[eng, { id: '2', key: 'PRD', name: 'Product', tone: 'violet' }]}
        onSelect={() => undefined}
        onShowAll={() => undefined}
        onCreate={() => undefined}
      />
      <div className="px-3 pb-2.5">
        <SearchInput placeholder="Search this space" size="md" tone="recessed" />
      </div>
      <div className="px-2">
        <PageTree
          label="Pages in Engineering"
          items={items}
          activeId={active}
          hrefOf={(item) => `#${item.id}`}
          onOpen={(item) => setActive(item.id)}
          onToggle={(item, expanded) =>
            setOpen((ids) => {
              const next = new Set(ids);
              if (expanded) next.add(item.id);
              else next.delete(item.id);
              return next;
            })
          }
          onMove={(move) => {
            const [node, rest] = take(nodes, move.id);
            if (node) setNodes(place(rest, node, move));
            if (move.parentId) setOpen((ids) => new Set([...ids, move.parentId ?? '']));
          }}
          onAddChild={() => undefined}
          menu={(item) => (
            <>
              <MenuItem onSelect={() => setRenaming(item.id)} icon={<Icon name="edit" />}>
                Rename
              </MenuItem>
              <MenuItem onSelect={() => undefined}>Star</MenuItem>
              <MenuSeparator />
              <MenuItem onSelect={() => undefined} tone="danger">
                Move to trash
              </MenuItem>
            </>
          )}
          renamingId={renaming}
          onRenameStart={(item) => setRenaming(item.id)}
          onRename={(item, title) => {
            setNodes((list) => rename(list, item.id, title));
            setRenaming(null);
          }}
          onRenameCancel={() => setRenaming(null)}
        />
      </div>
      <div className="mt-auto flex items-center gap-1 border-t border-br2 px-4 py-3 text-12h font-medium text-ac">
        <Icon name="plus" size={14} />
        New page
      </div>
    </aside>
  );
}

const rename = (nodes: Node[], id: string, title: string): Node[] =>
  nodes.map((node) =>
    node.id === id
      ? { ...node, title }
      : { ...node, ...(node.children ? { children: rename(node.children, id, title) } : {}) },
  );

const meta = {
  title: 'Docs/Page tree',
  component: Sidebar,
  parameters: {
    layout: 'fullscreen',
    mock: [{ file: 'Bemmoly Doc Editor.dc.html', x: 0, y: 48, w: 260, h: 720, note: 'sidebar' }],
  },
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Drag a row above, below or into another; Alt+arrows move the focused row. */
export const SpaceSidebar: Story = {};
