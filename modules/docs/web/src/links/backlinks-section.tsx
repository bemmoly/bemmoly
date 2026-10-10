import type { LinkedPage, LinkedRecord } from '@bemmoly/module-docs/shared';
import { PageStatusPill, Skeleton, StatusBadge, type StatusCategory } from '@bemmoly/ui';
import { PageIcon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { docsPaths, keepLinksInApp } from '../shared/navigation.ts';
import { useBacklinks, useOutgoingLinks, usePageReferences } from './use-links.ts';

const HEADING = 'm-0 text-11 font-medium tracking-caps text-tx5 uppercase';
const CARD =
  'flex flex-col gap-1 rounded-panel border border-br px-3 py-2.5 text-tx no-underline hover:border-br3 hover:bg-bg2 hover:text-tx focus-ring motion-safe:transition-colors';

const LINK_KIND_WORDS = { mention: 'Mentioned', embed: 'Embedded', linked: 'Linked' } as const;

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className={HEADING}>
        {title} <span className="font-mono text-tx6">{count}</span>
      </h3>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

/**
 * A record's workflow status, when its module sent one (an issue's), as a badge tone: the
 * same mapping Work's own screens use, written out here because Docs never imports Work.
 */
function statusOf(record: LinkedRecord): { name: string; tone: StatusCategory } | null {
  const status = record.data?.['status'] as { name?: unknown; category?: unknown } | undefined;
  if (!status || typeof status.name !== 'string') return null;
  const name = status.name;
  if (status.category === 'todo') return { name, tone: 'todo' };
  if (status.category === 'done') return { name, tone: 'done' };
  if (/review/i.test(name)) return { name, tone: 'review' };
  if (/\b(qa|test)/i.test(name)) return { name, tone: 'qa' };
  return { name, tone: 'progress' };
}

/** An issue or another module's record, as the mock's Linked work card: key, status, title. */
function RecordCard({
  record,
  kind,
}: {
  record: LinkedRecord;
  kind?: keyof typeof LINK_KIND_WORDS;
}) {
  const status = statusOf(record);
  return (
    <a href={record.path} className={CARD}>
      <span className="flex items-center gap-2">
        <span className="font-mono text-11h font-medium text-tx4">{record.key ?? record.kind}</span>
        {status && <StatusBadge size="sm" category={status.tone} label={status.name} />}
        {kind && <span className="ml-auto text-11 text-tx5">{LINK_KIND_WORDS[kind]}</span>}
      </span>
      <span className="line-clamp-2">{record.title || 'Untitled'}</span>
    </a>
  );
}

/** A page that links here: its icon and title, its space and status. */
function PageCard({ page }: { page: LinkedPage }) {
  return (
    <a href={docsPaths.page(page.pageId)} className={`${CARD} gap-0.5! py-2!`}>
      <span className="flex min-w-0 items-center gap-2">
        <PageIcon value={page.icon} size={14} className="shrink-0 text-tx4" />
        <span className="truncate">{page.title || 'Untitled'}</span>
        {page.status !== 'published' && (
          <PageStatusPill status={page.status} className="ml-auto shrink-0" />
        )}
      </span>
      <span className="text-11h text-tx5">
        {page.spaceKey} · {LINK_KIND_WORDS[page.kind]} here
      </span>
    </a>
  );
}

/**
 * The page's links for the About tab (the mock's Linked work): issues the page references,
 * the records that reference it ("Referenced in") and the pages that link to it. Each part
 * hides while empty; when all are, one quiet line says so.
 */
export function BacklinksSection({ pageId }: { pageId: string }) {
  const outgoing = useOutgoingLinks(pageId);
  const references = usePageReferences(pageId);
  const backlinks = useBacklinks(pageId);
  const issues = (outgoing.data ?? []).filter((link) => link.record);
  const loading = outgoing.isPending || references.isPending || backlinks.isPending;
  const failed = outgoing.isError && references.isError && backlinks.isError;

  if (loading) {
    return (
      <div role="status" className="flex flex-col gap-2 pt-2" aria-label="Loading links">
        <Skeleton width="35%" />
        <Skeleton width="80%" />
      </div>
    );
  }
  const refs = references.data ?? [];
  const pages = backlinks.data ?? [];
  if (failed || issues.length + refs.length + pages.length === 0) {
    return (
      <section aria-label="Linked work" className="flex flex-col gap-1.5 pt-2">
        <h3 className={HEADING}>Linked work</h3>
        <p className="m-0 text-12 text-tx5">
          {failed
            ? 'Links could not be loaded.'
            : 'Nothing links here yet. Mention this page in an issue or another page, and it shows up here.'}
        </p>
      </section>
    );
  }
  return (
    <div className="flex flex-col gap-4 pt-2" onClick={keepLinksInApp}>
      {issues.length > 0 && (
        <Section title="Issues referenced" count={issues.length}>
          {issues.map((link) => (
            <RecordCard key={`${link.targetKind}-${link.targetId}`} record={link.record!} />
          ))}
        </Section>
      )}
      {refs.length > 0 && (
        <Section title="Referenced in" count={refs.length}>
          {refs.map((record) => (
            <RecordCard
              key={`${record.kind}-${record.id}`}
              record={record}
              kind={record.linkKind}
            />
          ))}
        </Section>
      )}
      {pages.length > 0 && (
        <Section title="Backlinks" count={pages.length}>
          {pages.map((page) => (
            <PageCard key={page.pageId} page={page} />
          ))}
        </Section>
      )}
    </div>
  );
}
