import type { AttentionItem, Space } from '@bemmoly/module-docs/shared';
import { Button, Card, RelativeTime } from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import { useAttention } from '../hooks/home-queries.ts';
import { docsPaths } from '../shared/navigation.ts';
import type { DocsPersonView } from '../shared/people.ts';
import { pageCountLabel } from '../space/page-count.ts';
import { SpaceMark } from './page-row.tsx';

const HEAD = 'flex items-center gap-2 border-b border-br2 px-3.5 py-2.5';

function NeedRow({
  item,
  person,
}: {
  item: AttentionItem;
  person: (id: string | null) => DocsPersonView | null;
}) {
  const owner = person(item.page.ownerId);
  const why =
    item.kind === 'review'
      ? `${owner?.name ?? 'Someone'} asked you to review`
      : 'Not updated for a while';
  return (
    <a
      href={docsPaths.page(item.page.id)}
      data-list-row
      className="flex items-center gap-2.5 border-b border-br-row px-3.5 py-2.5 text-tx no-underline outline-0 last:border-b-0 hover:bg-hover focus-visible:bg-hover"
    >
      <Icon name={item.kind === 'review' ? 'eye' : 'clock'} size={15} className="text-tx4" />
      <span className="flex min-w-0 flex-1 flex-col text-12h">
        <span className="truncate text-tx4">{why}</span>
        <span className="flex min-w-0 items-center gap-1.5 font-semibold">
          <PageIcon value={item.page.icon} size={14} />
          <span className="truncate">{item.page.title || 'Untitled'}</span>
        </span>
      </span>
      {item.kind === 'review' && (
        <span className="shrink-0 text-11 text-tx5 tabular-nums">
          <RelativeTime iso={item.since} />
        </span>
      )}
    </a>
  );
}

/**
 * Needs you: reviews asked of the person, then stale pages they own; each opens the page.
 * Not drawn while nothing waits, so the column holds only what matters.
 */
export function NeedsYou({ person }: { person: (id: string | null) => DocsPersonView | null }) {
  const attention = useAttention();
  const items = attention.data?.items ?? [];
  if (attention.isError) {
    return (
      <Card className="flex items-center gap-2 px-3.5 py-3 text-12h text-tx4">
        <span className="flex-1">What needs you didn’t load.</span>
        <Button size="sm" variant="ghost" onClick={() => void attention.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }
  if (items.length === 0) return null;
  const reviews = items.filter((item) => item.kind === 'review').length;
  return (
    <Card className="overflow-hidden">
      <div className={HEAD}>
        <h2 className="m-0 flex-1 text-13 font-semibold text-tx">Needs you</h2>
        {reviews > 0 && (
          <span className="rounded-full bg-ac-fill px-1.5 text-11 font-semibold text-on-ac tabular-nums">
            {reviews}
          </span>
        )}
      </div>
      <div role="list" aria-label="Needs you">
        {items.map((item) => (
          <div role="listitem" key={`${item.kind}:${item.page.id}`}>
            <NeedRow item={item} person={person} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Spaces as a list: tile, name, pages and what the space is for; New space in the header. */
export function SpacesList({
  spaces,
  onCreateSpace,
}: {
  spaces: readonly Space[];
  onCreateSpace?: (() => void) | undefined;
}) {
  return (
    <Card className="overflow-hidden">
      <div className={HEAD}>
        <h2 className="m-0 flex-1 text-13 font-semibold text-tx">Spaces</h2>
        {onCreateSpace && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Icon name="plus" size={13} />}
            onClick={onCreateSpace}
          >
            New space
          </Button>
        )}
      </div>
      <ul className="m-0 list-none p-0">
        {spaces.map((space) => (
          <li key={space.id}>
            <a
              href={docsPaths.space(space.key)}
              className="flex items-center gap-2.5 px-3.5 py-2 text-tx no-underline outline-0 hover:bg-hover focus-visible:bg-hover"
            >
              <SpaceMark space={space} size={24} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-13 font-semibold">{space.name}</span>
                <span className="truncate text-12 text-tx4">
                  {pageCountLabel(space.pageCount)}
                  {space.description ? ` · ${space.description}` : ''}
                </span>
              </span>
              {space.memberCount > 0 && (
                <span className="flex shrink-0 items-center gap-1 text-12 text-tx5 tabular-nums">
                  <Icon name="people" size={13} label="Members" />
                  {space.memberCount}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
