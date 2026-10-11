import type { HomePage, Space } from '@bemmoly/module-docs/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api.ts';
import { docsKeys } from '../../shared/keys.ts';

/** A page nobody has touched for this long is stale, as the home's Needs you counts it. */
export const STALE_DAYS = 90;

/** The space's pages, most recently changed first, with who changed them. */
export function useSpaceRecent(spaceId: string) {
  return useQuery({
    queryKey: [...docsKeys.recent(false), 'space', spaceId],
    queryFn: () => api.docs.home.recent({ spaceId, limit: 50 }),
    select: (page) => page.items,
  });
}

export const isStale = (page: HomePage, now = Date.now()) =>
  now - new Date(page.updatedAt).getTime() > STALE_DAYS * 24 * 60 * 60 * 1000;

/** The space's home page, read to show its first lines under Start here. */
export function useHomePage(pageId: string | null) {
  return useQuery({
    queryKey: docsKeys.page(pageId ?? ''),
    queryFn: () => api.docs.pages.get(pageId ?? ''),
    enabled: Boolean(pageId),
  });
}

/** Pins another page as the space's home; anyone who may configure the space can. */
export function useSetHomePage(space: Space) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (homePageId: string) => api.docs.spaces.update(space.key, { homePageId }),
    onSuccess: (next) => {
      queryClient.setQueryData(docsKeys.space(space.key), next);
      void queryClient.invalidateQueries({ queryKey: docsKeys.spaces() });
    },
    onError: (error) =>
      toast.show({ tone: 'danger', title: 'Start here was not changed', body: error.message }),
  });
}

/** The space's members for the header's faces. */
export function useSpaceMembers(spaceKey: string) {
  return useQuery({
    queryKey: docsKeys.members(spaceKey),
    queryFn: () => api.docs.members.list(spaceKey),
    staleTime: 60_000,
  });
}
