import { isApiError } from '@bemmoly/api-client';
import { useQuery } from '@tanstack/react-query';
import type { PageDetail } from '../../../shared/pages.ts';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';

export type PageLoad =
  | { state: 'loading' }
  /** A live page, or one in the trash (deletedAt set) for the restore banner. */
  | { state: 'ready'; page: PageDetail }
  | { state: 'not-found' }
  | { state: 'forbidden' }
  | { state: 'error'; message: string; retry: () => void };

const status = (error: unknown) => (isApiError(error) ? error.status : 0);

/** A missing or refused page answers at once; a server hiccup is worth a second try. */
const retry = (count: number, error: unknown) => {
  const code = status(error);
  return (code === 0 || code >= 500) && count < 2;
};

/** The trashed copy of a page, read only after the live read said it is gone. */
export const trashedPageKey = (pageId: string) => [...docsKeys.page(pageId), 'trashed'] as const;

/**
 * The page at /docs/p/:pageId and which of the screen's states it is in. A 404 asks again
 * for the page in the trash, so a trashed page opens with its restore banner rather than as
 * missing; a 403 is "no access", which the screen words differently from "not found".
 */
export function usePageLoad(pageId: string | undefined): PageLoad {
  const live = useQuery({
    queryKey: docsKeys.page(pageId ?? ''),
    queryFn: () => api.docs.pages.get(pageId ?? ''),
    enabled: Boolean(pageId),
    retry,
  });
  const gone = live.isError && status(live.error) === 404;
  const trashed = useQuery({
    queryKey: trashedPageKey(pageId ?? ''),
    queryFn: () => api.docs.pages.get(pageId ?? '', { deleted: true }),
    enabled: Boolean(pageId) && gone,
    retry,
  });

  if (!pageId) return { state: 'not-found' };
  if (live.data && !gone) return { state: 'ready', page: live.data };
  if (live.isPending) return { state: 'loading' };
  if (status(live.error) === 403) return { state: 'forbidden' };
  if (!gone) {
    return {
      state: 'error',
      message: live.error instanceof Error ? live.error.message : 'The page did not load',
      retry: () => void live.refetch(),
    };
  }
  if (trashed.isPending) return { state: 'loading' };
  if (trashed.data?.deletedAt) return { state: 'ready', page: trashed.data };
  if (status(trashed.error) === 403) return { state: 'forbidden' };
  return { state: 'not-found' };
}
