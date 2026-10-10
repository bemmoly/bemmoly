import { formatRelative, HeaderActions } from '@bemmoly/core-web';
import {
  Button,
  Card,
  DocListRow,
  DocListRowSkeleton,
  EmptyState,
  PAGE_STATUS_LABELS,
  SpaceTile,
  spaceTone,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { DocsLayout } from '../shared/docs-layout.tsx';
import { ImportDialog } from '../transfer/index.ts';
import { usePeople } from '../shared/people.ts';
import { docsPaths } from '../shared/navigation.ts';
import { pageCountLabel } from './page-count.ts';
import { useSpaceActions } from './space-layout.tsx';
import { useSpaceTree } from './use-space-tree.ts';

/**
 * A space without a home page: its name and what it holds, and its top-level pages in the
 * Docs home's list style. A space with nothing in it yet asks for the first page.
 */
export function SpaceOverview() {
  const { space, createPage } = useSpaceActions();
  const tree = useSpaceTree(space.key);
  const { person } = usePeople();
  const roots = tree.items.filter((item) => item.depth === 0);
  const [importing, setImporting] = useState(false);

  return (
    <DocsLayout layout="contained">
      <HeaderActions>
        <Button
          variant="ghost"
          icon={<Icon name="download" size={14} />}
          onClick={() => setImporting(true)}
        >
          Import
        </Button>
        <Button
          variant="primary"
          icon={<Icon name="plus" size={14} />}
          onClick={() => createPage(null)}
        >
          New page
        </Button>
      </HeaderActions>
      <div className="flex flex-col gap-7">
        <header className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <SpaceTile
              name={space.name}
              spaceKey={space.key}
              tone={spaceTone(space.key, space.color)}
            />
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="m-0 truncate text-24 font-semibold tracking-display text-tx">
                {space.name}
              </h1>
              <p className="m-0 text-13 text-tx-3">
                {pageCountLabel(space.pageCount)} · {space.key}
                {space.description ? ` · ${space.description}` : ''}
              </p>
            </div>
          </div>
        </header>

        <section aria-label="Pages" className="flex flex-col gap-3">
          <h2 className="m-0 text-16 font-semibold text-tx">Pages</h2>
          {tree.isPending ? (
            <Card className="overflow-hidden">
              <DocListRowSkeleton rows={4} />
            </Card>
          ) : roots.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Icon name="doc" />}
                title="Nothing written here yet"
                description="Start the space with a page: a blank one, or an RFC, a runbook or meeting notes from a template."
                action={<Button onClick={() => createPage(null)}>Write the first page</Button>}
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              {roots.map((item) => {
                const page = tree.summaries.get(item.id);
                return (
                  <DocListRow
                    key={item.id}
                    href={docsPaths.page(item.id)}
                    title={item.title}
                    icon={item.icon ?? null}
                    place={
                      page
                        ? `${PAGE_STATUS_LABELS[page.status]}${item.hasChildren ? ' · has subpages' : ''}`
                        : space.name
                    }
                    person={person(page?.ownerId)}
                    when={page ? formatRelative(page.updatedAt) : ''}
                  />
                );
              })}
            </Card>
          )}
        </section>
      </div>
      <ImportDialog open={importing} onClose={() => setImporting(false)} space={space} />
    </DocsLayout>
  );
}
