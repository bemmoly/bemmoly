import { Skeleton } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';
import { IssueCard } from './issue-chip.tsx';

/** Rows a document table shows, so a broad query never turns a page into a backlog. */
const ROWS = 10;

/**
 * A saved LQL query drawn live inside a document: its title, the first rows
 * the reader may see (Work's query endpoint keeps to their projects) and a
 * note when there are more. A query Work cannot read shows its error, not a crash.
 */
export function IssueTable({ query, title }: { query: string; title: string }) {
  const result = useQuery({
    queryKey: [...workKeys.all(), 'issue-query', query, ROWS] as const,
    queryFn: () => api.work.filters.run(query, ROWS),
    staleTime: 30_000,
    retry: false,
    enabled: query.trim().length > 0,
  });
  const items = result.data?.items ?? [];
  return (
    <figure className="m-0 flex flex-col gap-1.5 rounded-card border border-br2 bg-sf p-3">
      <figcaption className="flex items-baseline justify-between gap-3 text-12 text-tx3">
        <span className="font-semibold text-tx">{title || 'Issues'}</span>
        <code className="truncate font-mono text-11 text-tx4" title={query}>
          {query}
        </code>
      </figcaption>
      {result.isPending && query.trim() ? (
        <div aria-busy className="flex flex-col gap-1.5">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} height={36} />
          ))}
        </div>
      ) : result.isError ? (
        <p className="m-0 text-12 text-tx4">This query could not be run: {result.error.message}</p>
      ) : items.length === 0 ? (
        <p className="m-0 text-12 text-tx4">No issues match this query.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {items.map((issue) => (
            <li key={issue.id}>
              <IssueCard entityKey={issue.key} />
            </li>
          ))}
        </ul>
      )}
      {result.data?.nextCursor && (
        <p className="m-0 text-12 text-tx4">Showing the first {ROWS} issues.</p>
      )}
    </figure>
  );
}
