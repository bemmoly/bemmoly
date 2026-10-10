import type { PageSummary, Space } from '@bemmoly/module-docs/shared';
import { SpaceCard, SpaceCardSkeleton, spaceTone, type SpaceCardPerson } from '@bemmoly/ui';
import { docsPaths } from '../shared/navigation.ts';
import type { DocsPersonView } from '../shared/people.ts';
import { pageCountLabel } from '../space/page-count.ts';

export const SPACE_GRID = 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3';

export interface SpaceGridProps {
  spaces: readonly Space[];
  /** Recent pages across spaces: the people on a card are the ones writing there lately. */
  recent: readonly PageSummary[];
  person: (id: string | null) => DocsPersonView | null;
}

function writersOf(
  spaceId: string,
  recent: readonly PageSummary[],
  person: SpaceGridProps['person'],
): SpaceCardPerson[] {
  const ids = [
    ...new Set(
      recent.filter((page) => page.spaceId === spaceId && page.ownerId).map((page) => page.ownerId),
    ),
  ];
  return ids
    .slice(0, 5)
    .map((id) => person(id))
    .filter((found): found is DocsPersonView => Boolean(found));
}

/**
 * The Docs mock's space cards, three to a row: the tile and name, the page count (and, for
 * a project space, its PROJECT tag), the first pages of its tree (sent with the space, so
 * there is no request per card), and who has been writing there. On narrower screens they go two, then one, to a row.
 */
export function SpaceGrid({ spaces, recent, person }: SpaceGridProps) {
  return (
    <section aria-labelledby="docs-spaces" className="flex flex-col gap-3">
      <h2 id="docs-spaces" className="m-0 text-16 font-semibold text-tx">
        Spaces
      </h2>
      <div className={SPACE_GRID}>
        {spaces.map((space) => (
          <SpaceCard
            key={space.id}
            href={docsPaths.space(space.key)}
            name={space.name}
            spaceKey={space.key}
            tone={spaceTone(space.key, space.color)}
            meta={pageCountLabel(space.pageCount)}
            project={Boolean(space.projectId)}
            pages={space.topPages.map((page) => page.title || 'Untitled')}
            people={writersOf(space.id, recent, person)}
          />
        ))}
      </div>
    </section>
  );
}

export function SpaceGridSkeleton() {
  return (
    <section aria-label="Loading spaces" className="flex flex-col gap-3">
      <span className="h-4.5" />
      <div className={SPACE_GRID}>
        {Array.from({ length: 3 }, (_, index) => (
          <SpaceCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}
