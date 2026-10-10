import type { Space } from '@bemmoly/module-docs/shared';
import { Kbd, SearchInput } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useDeferredValue, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { pageCountLabel } from './page-count.ts';
import { SidebarSearch } from './sidebar-search.tsx';
import { SpaceMenu } from './sidebar-space.tsx';
import { SidebarTree } from './sidebar-tree.tsx';
import { SpaceTile } from './space-tile.tsx';

export interface SidebarFocusProps {
  space: Space;
  activePageId: string | undefined;
  onExit: () => void;
}

/**
 * Focus mode (docs-tree.js, "Big spaces"): one space has the Docs section to itself, its tree
 * flush left with a filter above it. F moves to the filter; Esc clears it, and Esc again (or
 * "All of Docs") goes back to every space.
 */
export function SidebarFocus({ space, activePageId, onExit }: SidebarFocusProps) {
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.trim());
  const filter = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  // Entering focus mode puts the caret in the filter, the reason to be here in a big space.
  useEffect(() => filter.current?.focus(), [space.key]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const inFilter = event.target === filter.current;
    if (event.key === 'Escape' && !(inFilter && query)) {
      event.preventDefault();
      onExit();
    } else if (event.key === 'f' && !inFilter && !event.metaKey && !event.ctrlKey) {
      if ((event.target as HTMLElement).closest('input, textarea')) return;
      event.preventDefault();
      filter.current?.focus();
    }
  };

  return (
    <div ref={root} className="flex flex-col gap-0.5" onKeyDown={onKeyDown}>
      <button
        type="button"
        onClick={onExit}
        className="flex h-7.5 cursor-pointer items-center gap-2 rounded-control border-0 bg-transparent px-2 text-left font-sans text-13 text-tx-2 hover:bg-hover hover:text-tx focus-ring-inset"
      >
        <Icon name="back" size={15} className="text-tx-3" />
        <span className="min-w-0 flex-1">All of Docs</span>
        <Kbd keys="Esc" />
      </button>
      <div className="flex h-8 items-center gap-2 px-2 pt-1">
        <SpaceTile space={space} size={20} />
        <span className="min-w-0 flex-1 truncate text-13 font-semibold text-tx">{space.name}</span>
        <SpaceMenu space={space} />
      </div>
      <div className="px-0.5 pt-1 pb-1.5">
        <SearchInput
          ref={filter}
          aria-label={`Filter ${space.name}`}
          placeholder={`Filter ${pageCountLabel(space.pageCount)}`}
          tone="subtle"
          wrapperClassName="h-7! gap-1.75! px-2!"
          className="text-12h!"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && query) {
              event.stopPropagation();
              setQuery('');
            }
          }}
        />
      </div>
      <nav aria-label={`${space.name} pages`}>
        {q ? (
          <SidebarSearch spaceId={space.id} q={q} />
        ) : (
          <SidebarTree space={space} activePageId={activePageId ?? null} indentStart={6} />
        )}
      </nav>
    </div>
  );
}
