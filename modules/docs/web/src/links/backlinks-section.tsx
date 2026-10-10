import type { LinkedPage, LinkedRecord } from '@bemmoly/module-docs/shared';
import {
  focusRing,
  PageStatusPill,
  Skeleton,
  StatusGlyph,
  statusStage,
  TypeGlyph,
  type IssueTypeLike,
  type StatusCategoryKey,
} from '@bemmoly/ui';
import { PageIcon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { useIssueRenderer } from '../shared/issue-services.tsx';
import { docsPaths, keepLinksInApp } from '../shared/navigation.ts';
import { useBacklinks, useOutgoingLinks, usePageReferences } from './use-links.ts';

/*
 * The page's Linked work (the Docs review's Linked work tab): issues in this page with how far
 * along they are, issues that link here, and pages that link here, each issue once. Issue rows
 * are Work's own row (type tile, key, title, status glyph, assignee) through the kernel's
 * entity registry; with Work off they print from what the link carries, in the same order.
 */

const ROW = `flex h-9 min-w-0 items-center gap-2 rounded-card px-2 text-13 text-tx no-underline hover:bg-hover ${focusRing}`;

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
    <section aria-label={title} className="flex flex-col">
      <h3 className="m-0 mx-2 mt-4 mb-1 flex gap-1.5 text-12 font-semibold text-tx-3">
        {title}
        <span className="font-medium tabular-nums">{count}</span>
      </h3>
      {children}
    </section>
  );
}

interface IssueData {
  status?: { name?: unknown; category?: unknown } | null;
  type?: IssueTypeLike | null;
}

const CATEGORIES = new Set<StatusCategoryKey>(['todo', 'in_progress', 'done']);

function categoryOf(record: LinkedRecord): StatusCategoryKey | null {
  const category = (record.data as IssueData | undefined)?.status?.category;
  return CATEGORIES.has(category as StatusCategoryKey) ? (category as StatusCategoryKey) : null;
}

/** A record drawn from the link alone, for Work off or a record of another module. */
function PlainRecord({ record }: { record: LinkedRecord }) {
  const data = record.data as IssueData | undefined;
  const category = categoryOf(record);
  const name = typeof data?.status?.name === 'string' ? data.status.name : undefined;
  return (
    <a href={record.path} className={ROW}>
      {data?.type && <TypeGlyph type={data.type} size={15} />}
      <span className="font-mono text-12 text-tx-3">{record.key ?? record.kind}</span>
      <span className="min-w-0 flex-1 truncate" title={record.title}>
        {record.title || 'Untitled'}
      </span>
      {category && (
        <StatusGlyph
          stage={statusStage(category, name)}
          size={13}
          {...(name ? { label: name } : {})}
        />
      )}
    </a>
  );
}

function RecordRow({ record }: { record: LinkedRecord }) {
  const Row = useIssueRenderer()?.Card;
  if (Row && record.kind === 'issue' && record.key) return <Row entityKey={record.key} />;
  return <PlainRecord record={record} />;
}

/** "2 of 3 in progress, none done", over a bar in the status colours. */
function Progress({ records }: { records: readonly LinkedRecord[] }) {
  const total = records.length;
  const done = records.filter((record) => categoryOf(record) === 'done').length;
  const moving = records.filter((record) => categoryOf(record) === 'in_progress').length;
  const width = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="mx-2 mt-1.5 flex items-center gap-2 text-12 text-tx-3">
      <span aria-hidden className="flex h-1 w-30 overflow-hidden rounded-full bg-line">
        <i className="bg-done" style={{ width: width(done) }} />
        <i className="bg-prog" style={{ width: width(moving) }} />
      </span>
      <span className="tabular-nums">
        {moving} of {total} in progress, {done ? `${done} done` : 'none done'}
      </span>
    </div>
  );
}

function PageRow({ page }: { page: LinkedPage }) {
  return (
    <a href={docsPaths.page(page.pageId)} className={ROW}>
      <PageIcon value={page.icon} size={15} className="shrink-0 text-tx-3" />
      <span className="min-w-0 flex-1 truncate">{page.title || 'Untitled'}</span>
      {page.status !== 'published' && <PageStatusPill status={page.status} className="shrink-0" />}
      <span className="shrink-0 text-12 text-tx-3">{page.spaceKey}</span>
    </a>
  );
}

const recordId = (record: LinkedRecord) => `${record.kind}:${record.key ?? record.id}`;

export function BacklinksSection({ pageId }: { pageId: string }) {
  const outgoing = useOutgoingLinks(pageId);
  const references = usePageReferences(pageId);
  const backlinks = useBacklinks(pageId);
  const loading = outgoing.isPending || references.isPending || backlinks.isPending;
  const failed = outgoing.isError && references.isError && backlinks.isError;

  if (loading) {
    return (
      <div role="status" className="flex flex-col gap-2 px-2 pt-4" aria-label="Loading links">
        <Skeleton width="35%" />
        <Skeleton width="80%" />
      </div>
    );
  }
  const inPage = (outgoing.data ?? []).flatMap((link) => (link.record ? [link.record] : []));
  const seen = new Set(inPage.map(recordId));
  const linkHere = (references.data ?? []).filter((record) => {
    const fresh = !seen.has(recordId(record));
    seen.add(recordId(record));
    return fresh;
  });
  const pages = backlinks.data ?? [];
  if (failed || inPage.length + linkHere.length + pages.length === 0) {
    return (
      <section aria-label="Linked work" className="flex flex-col gap-1.5 px-2 pt-4">
        <p className="m-0 text-12 text-tx-3">
          {failed
            ? 'Links could not be loaded. Reopen the panel to try again.'
            : 'Nothing links here yet. Type # to embed an issue, or mention this page elsewhere.'}
        </p>
      </section>
    );
  }
  return (
    <div className="flex flex-col" onClick={keepLinksInApp}>
      {inPage.length > 0 && (
        <Section title="In this page" count={inPage.length}>
          {inPage.map((record) => (
            <RecordRow key={recordId(record)} record={record} />
          ))}
          <Progress records={inPage} />
        </Section>
      )}
      {linkHere.length > 0 && (
        <Section title="Issues that link here" count={linkHere.length}>
          {linkHere.map((record) => (
            <RecordRow key={recordId(record)} record={record} />
          ))}
        </Section>
      )}
      {pages.length > 0 && (
        <Section title="Pages that link here" count={pages.length}>
          {pages.map((page) => (
            <PageRow key={page.pageId} page={page} />
          ))}
        </Section>
      )}
    </div>
  );
}
