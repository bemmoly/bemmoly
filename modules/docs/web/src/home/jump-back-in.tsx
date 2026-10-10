import type { HomePage, Space } from '@bemmoly/module-docs/shared';
import { RelativeTime, Skeleton } from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import { useStarredIds } from '../hooks/home-queries.ts';
import { docsPaths } from '../shared/navigation.ts';

const CARD =
  'flex min-w-0 flex-col gap-3 rounded-card border border-line bg-card p-3.5 text-tx no-underline outline-0 ' +
  'hover:border-line hover:shadow-e1 focus-visible:border-acc focus-visible:shadow-ring motion-safe:transition-[border-color,box-shadow]';

/**
 * The last four pages touched, as cards: icon, title, space and who edited them when. A
 * starred page shows its star. Nothing is drawn before there is something to go back to.
 */
export function JumpBackIn({
  pages,
  pending,
  spaces,
  meId,
}: {
  pages: readonly HomePage[];
  pending: boolean;
  spaces: ReadonlyMap<string, Space>;
  meId: string | null;
}) {
  const starred = useStarredIds();
  if (!pending && pages.length === 0) return null;
  return (
    <section aria-labelledby="jump-back-in" className="flex flex-col gap-2.5">
      <h2 id="jump-back-in" className="m-0 text-13 font-semibold text-tx-2">
        Jump back in
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {pending
          ? [0, 1, 2, 3].map((key) => <Skeleton key={key} height={98} className="rounded-card" />)
          : pages.slice(0, 4).map((page) => {
              const editor = page.lastEditor;
              const who = editor ? (editor.id === meId ? 'You' : editor.name) : null;
              return (
                <a key={page.id} href={docsPaths.page(page.id)} className={CARD}>
                  <span className="flex items-center justify-between">
                    <PageIcon value={page.icon} size={18} className="text-tx-2" />
                    {starred.has(page.id) && (
                      <Icon name="star" size={14} label="Starred" className="text-amber" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-13 font-semibold">
                      {page.title || 'Untitled'}
                    </span>
                    <span className="truncate text-12 text-tx-3">
                      {spaces.get(page.spaceId)?.name ?? page.spaceKey}
                      {who && (
                        <>
                          {' · '}
                          {who} edited <RelativeTime iso={page.updatedAt} />
                        </>
                      )}
                    </span>
                  </span>
                </a>
              );
            })}
      </div>
    </section>
  );
}
