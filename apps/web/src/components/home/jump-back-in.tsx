import { useFrameLink, useRecents, type RecentItem } from '@bemmoly/core-web';
import { Kbd, RelativeTime } from '@bemmoly/ui';
import { RecentMark, RecentStatus } from '../shell/recent-mark.tsx';

function RecentCard({ item }: { item: RecentItem }) {
  const link = useFrameLink(item.path);
  return (
    <a
      {...link}
      className="flex min-w-0 flex-col gap-3 rounded-card bg-card p-3.5 text-tx no-underline shadow-e1 hover:shadow-e1h focus-ring motion-safe:transition-shadow"
    >
      <span className="flex items-center gap-2 text-tx-2">
        <RecentMark look={item.look} />
        <RecentStatus look={item.look} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium" title={item.title}>
          {item.handle ? (
            <span className="mr-1.5 font-mono text-11 text-tx-3">{item.handle}</span>
          ) : null}
          {item.title}
        </span>
        <span className="truncate text-12 text-tx-3">
          {item.context ? `${item.context} · ` : ''}
          <RelativeTime iso={item.openedAt} />
        </span>
      </span>
    </a>
  );
}

/**
 * The last four things the person opened, from the same per-person recents as ⌘K. Before
 * there are any, one quiet line says how they get here.
 */
export function JumpBackIn() {
  const recents = useRecents(4);
  return (
    <section aria-labelledby="jump-back-in" className="flex flex-col gap-2.5">
      <h2 id="jump-back-in" className="m-0 text-13 font-semibold text-tx-2">
        Jump back in
      </h2>
      {recents.length === 0 ? (
        <p className="m-0 flex flex-wrap items-center gap-1.5 rounded-card border border-dashed border-line px-4 py-3.5 text-13 text-tx-3">
          Issues, boards and pages you open show up here. Find anything with <Kbd keys="Mod+K" />
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {recents.map((item) => (
            <RecentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
