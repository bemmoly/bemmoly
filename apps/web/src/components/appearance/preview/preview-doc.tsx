import { AiSummary, Avatar, avatarHue, EntityTile, Tag } from '@bemmoly/ui';
import { SAMPLE_PAGES } from './preview-data.ts';
import { PreviewSidebar } from './preview-sidebar.tsx';

const ACTIVE_PAGE = 'Auth service RFC';

/** A representative doc page: the sidebar, the space's page tree, then a page with an AI TL;DR. */
export function PreviewDoc() {
  return (
    <div className="flex h-full">
      <PreviewSidebar active="docs" />
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside className="flex w-60 shrink-0 flex-col gap-3.5 border-r border-br bg-sf px-2 py-4">
          <span className="flex items-center gap-2.5 px-2">
            <EntityTile name="Engineering" tone="accent" size={30} />
            <span className="flex flex-col gap-px">
              <span className="text-13h font-semibold text-tx">Engineering</span>
              <span className="text-12 text-tx4">Doc space</span>
            </span>
          </span>
          <span className="flex flex-col gap-px">
            {SAMPLE_PAGES.map((page) => (
              <span
                key={page}
                className={`rounded-control px-2.5 py-1.75 ${
                  page === ACTIVE_PAGE ? 'bg-ac-bg font-medium text-ac' : 'text-tx2'
                }`}
              >
                {page}
              </span>
            ))}
          </span>
        </aside>
        <div className="flex min-w-0 flex-1 justify-center overflow-hidden bg-sf">
          <div className="flex w-180 flex-col gap-4 pt-10">
            <span className="text-12h text-tx4">Engineering / RFCs</span>
            <span className="text-26 font-semibold tracking-display text-tx">{ACTIVE_PAGE}</span>
            <span className="flex items-center gap-2 text-12h text-tx4">
              <Avatar name="Priya N." hue={avatarHue('Priya N.')} size={22} />
              Priya N. · edited 2 hours ago
              <Tag size="sm">rfc</Tag>
              <Tag size="sm" tone="accent">
                In review
              </Tag>
            </span>
            <AiSummary variant="page" title="TL;DR" source="from the page and 14 comments">
              Move sessions into Postgres behind a flag, migrate in two batches, and keep the old
              path for one release so a rollback is a flag flip.
            </AiSummary>
            <span className="text-16 font-semibold text-tx">Why now</span>
            <p className="m-0 leading-body text-tx-body">
              The auth service keeps sessions in a separate store that we back up by hand. Moving
              them into Postgres puts them in the nightly backup and lets us drop a service from
              every install.
            </p>
            <span className="text-16 font-semibold text-tx">Rollout</span>
            <p className="m-0 leading-body text-tx-body">
              Dual-write for one week, compare reads, then switch the flag per workspace. The
              rollback window is thirty minutes, the same as the flag TTL.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
