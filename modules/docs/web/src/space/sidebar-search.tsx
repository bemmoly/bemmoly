import { EmptyState, Skeleton } from '@bemmoly/ui';
import { isIconName } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { Fragment } from 'react';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';
import { docsPaths } from '../shared/navigation.ts';

/** "a <b>flag</b> flip" → text with the hits marked, without trusting the markup. */
function Snippet({ html }: { html: string }) {
  const parts = html.split(/<\/?b>/);
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index % 2 === 1 ? <mark className="bg-ac-bg2 text-tx">{part}</mark> : part}
        </Fragment>
      ))}
    </>
  );
}

/**
 * "Search this space": keyword search over the space's pages, shown in place of the tree
 * while there is a query. Each hit is a link with the matched words marked.
 */
export function SidebarSearch({ spaceId, q }: { spaceId: string; q: string }) {
  const hits = useQuery({
    queryKey: docsKeys.spaceSearch(spaceId, q),
    queryFn: () => api.docs.search.pages({ q, spaceId, limit: 20 }),
    enabled: q.length > 0,
    placeholderData: (previous) => previous,
  });
  if (hits.isPending) {
    return (
      <div role="status" aria-label="Searching" className="flex flex-col gap-3 px-2.5 pt-1">
        {[70, 55, 62].map((width) => (
          <span key={width} className="flex flex-col gap-1.5">
            <Skeleton width={`${width}%`} height={10} />
            <Skeleton width="90%" height={8} />
          </span>
        ))}
      </div>
    );
  }
  if (hits.isError) {
    return <EmptyState size="sm" title="Search failed" description={hits.error.message} />;
  }
  if (hits.data.length === 0) {
    return (
      <EmptyState size="sm" title="No pages match" description={`Nothing here mentions “${q}”.`} />
    );
  }
  return (
    <ul aria-label={`Pages matching ${q}`} className="m-0 flex list-none flex-col gap-px p-0">
      {hits.data.map((hit) => (
        <li key={hit.id}>
          <a
            href={docsPaths.page(hit.id)}
            className="flex flex-col gap-0.5 rounded-control px-2.5 py-1.5 text-13 text-tx2 no-underline hover:bg-bg2 hover:text-tx2"
          >
            <span className="truncate font-medium text-tx">
              {hit.icon && !isIconName(hit.icon) ? `${hit.icon} ` : ''}
              {hit.title || 'Untitled'}
            </span>
            {hit.snippet && (
              <span className="line-clamp-2 text-12 leading-note text-tx4">
                <Snippet html={hit.snippet} />
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
