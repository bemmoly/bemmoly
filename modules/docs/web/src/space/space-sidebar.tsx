import type { Space } from '@bemmoly/module-docs/shared';
import {
  SearchInput,
  SpaceSwitcher,
  spaceTone,
  type PageTreeItem,
  type SwitcherSpace,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useDeferredValue, useState } from 'react';
import { useSpaces } from '../hooks/queries.ts';
import { ImportDialog } from '../transfer/index.ts';
import { docsPaths, navigateTo } from '../shared/navigation.ts';
import { SidebarSearch } from './sidebar-search.tsx';
import { SidebarTree } from './sidebar-tree.tsx';

export interface SpaceSidebarProps {
  space: Space;
  activePageId: string | null;
  /** New page at the root (null) or inside a page. */
  onCreatePage: (parent: PageTreeItem | null) => void;
  /** Absent for someone who may not create spaces. */
  onCreateSpace?: (() => void) | undefined;
  /** Trash is open in the main column. */
  inTrash?: boolean;
}

const switcherSpace = (space: Space): SwitcherSpace => ({
  id: space.id,
  key: space.key,
  name: space.name,
  tone: spaceTone(space.key, space.color),
});

export const pageCountLabel = (count: number) => `${count} ${count === 1 ? 'page' : 'pages'}`;

/**
 * The space sidebar of the Doc Editor mock, 260px on sf with a br rule: the space head
 * (which switches spaces), "Search this space", the page tree, and "New page" pinned to
 * the bottom over a br2 rule. The trash sits at the right of that last line.
 */
export function SpaceSidebar({
  space,
  activePageId,
  onCreatePage,
  onCreateSpace,
  inTrash = false,
}: SpaceSidebarProps) {
  const spaces = useSpaces();
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.trim());
  const [importing, setImporting] = useState(false);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SpaceSwitcher
        current={switcherSpace(space)}
        meta={pageCountLabel(space.pageCount)}
        spaces={(spaces.data ?? [space]).map(switcherSpace)}
        onSelect={(next) => navigateTo(docsPaths.space(next.key))}
        onShowAll={() => navigateTo(docsPaths.home())}
        {...(onCreateSpace ? { onCreate: onCreateSpace } : {})}
      />
      <div className="px-3 pb-2.5">
        <SearchInput
          aria-label={`Search ${space.name}`}
          placeholder="Search this space"
          tone="subtle"
          wrapperClassName="h-7.5! gap-1.75! px-2.25!"
          className="text-12h!"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && setQuery('')}
        />
      </div>
      <nav aria-label={`${space.name} pages`} className="min-h-0 flex-1 overflow-auto px-2 pb-3">
        {q ? (
          <SidebarSearch spaceId={space.id} q={q} />
        ) : (
          <SidebarTree
            space={space}
            activePageId={activePageId}
            onAddChild={onCreatePage}
            onCreate={() => onCreatePage(null)}
          />
        )}
      </nav>
      <div className="flex items-center border-t border-br2 px-4 py-3 text-12h">
        <button
          type="button"
          onClick={() => onCreatePage(null)}
          className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-sans text-12h font-medium text-ac hover:text-ac-d"
        >
          <Icon name="plus" size={14} />
          New page
        </button>
        <button
          type="button"
          onClick={() => setImporting(true)}
          className="ml-auto cursor-pointer border-0 bg-transparent p-0 font-sans text-12h text-tx5 hover:text-tx3"
        >
          Import
        </button>
        <a
          href={docsPaths.trash(space.key)}
          aria-current={inTrash ? 'page' : undefined}
          className="ml-3 flex items-center gap-1 text-tx5 no-underline hover:text-tx3 aria-[current=page]:text-ac"
        >
          <Icon name="trash" size={14} />
          Trash
        </a>
      </div>
      <ImportDialog open={importing} onClose={() => setImporting(false)} space={space} />
    </div>
  );
}
