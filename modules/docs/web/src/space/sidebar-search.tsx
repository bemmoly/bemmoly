import { useFrameLink } from '@bemmoly/core-web';
import { Button, Skeleton } from '@bemmoly/ui';
import { PageIcon } from '@bemmoly/ui/icons';
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
          {index % 2 === 1 ? <mark className="bg-acc-50 text-tx">{part}</mark> : part}
        </Fragment>
      ))}
    </>
  );
}

interface Hit {
  id: string;
  title: string;
  icon: string | null;
  snippet?: string | null;
}

/** One hit: the page's icon and title, the matching line under it; opens in place. */
function HitLink({ hit }: { hit: Hit }) {
  const link = useFrameLink(docsPaths.page(hit.id));
  return (
    <a
      {...link}
      className="flex flex-col gap-0.5 rounded-control px-2 py-1.5 text-13 text-tx-2 no-underline hover:bg-hover hover:text-tx focus-ring-inset"
    >
      <span className="flex min-w-0 items-center gap-1.5 font-medium text-tx">
        <PageIcon value={hit.icon} size={15} className="text-tx-3" />
        <span className="truncate">{hit.title || 'Untitled'}</span>
      </span>
      {hit.snippet && (
        <span className="line-clamp-2 pl-5.25 text-12 leading-note text-tx-3">
          <Snippet html={hit.snippet} />
        </span>
      )}
    </a>
  );
}

const QUIET = 'm-0 flex min-h-7 items-center gap-2 px-2 text-12 text-tx-3';

/**
 * The focus mode filter": keyword search over the space's pages, shown in place of the tree
 * while there is a query. Each hit is a link with the matched words marked; a failed search says
 * so and offers Retry, in place.
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
      <div role="status" aria-label="Searching" className="flex flex-col gap-3 px-2 pt-1">
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
    return (
      <p className={QUIET}>
        <span className="min-w-0 flex-1">The search did not answer.</span>
        <Button size="sm" variant="ghost" onClick={() => void hits.refetch()}>
          Retry
        </Button>
      </p>
    );
  }
  if (hits.data.length === 0) return <p className={QUIET}>No page here mentions “{q}”.</p>;
  return (
    <ul aria-label={`Pages matching ${q}`} className="m-0 flex list-none flex-col gap-px p-0">
      {hits.data.map((hit) => (
        <li key={hit.id}>
          <HitLink hit={hit} />
        </li>
      ))}
    </ul>
  );
}
