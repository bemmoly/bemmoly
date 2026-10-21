import type {
  CreateInitiativeBody,
  Initiative,
  UpdateInitiativeBody,
} from '@bemmoly/module-work/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';

/*
 * Initiatives as the list and the program view read and change them. Every write refreshes
 * the initiatives and the roadmaps, since linking an epic changes what a program's timeline
 * draws. Initiatives have no realtime channel, so the lists also refetch on focus.
 */

export function useInitiativeList(archived: boolean) {
  return useQuery({
    queryKey: workKeys.initiativeList(archived),
    queryFn: ({ signal }) => api.work.initiatives.list({ archived, limit: 200 }, { signal }),
  });
}

export function useInitiative(id: string | undefined) {
  return useQuery({
    queryKey: workKeys.initiative(id ?? ''),
    queryFn: ({ signal }) => api.work.initiatives.get(id ?? '', { signal }),
    enabled: Boolean(id),
  });
}

export function useInitiativeActions() {
  const queryClient = useQueryClient();
  const refresh = async (initiative?: Initiative) => {
    if (initiative) queryClient.setQueryData(workKeys.initiative(initiative.id), initiative);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: workKeys.initiatives() }),
      queryClient.invalidateQueries({ queryKey: workKeys.roadmaps() }),
    ]);
  };
  const create = useMutation({
    mutationFn: (body: CreateInitiativeBody) => api.work.initiatives.create(body),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateInitiativeBody }) =>
      api.work.initiatives.update(id, body),
    onSuccess: refresh,
  });
  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      archived ? api.work.initiatives.archive(id) : api.work.initiatives.unarchive(id),
    onSuccess: refresh,
  });
  const link = useMutation({
    mutationFn: ({ id, epicId }: { id: string; epicId: string }) =>
      api.work.initiatives.linkEpic(id, epicId),
    onSuccess: refresh,
  });
  const unlink = useMutation({
    mutationFn: ({ id, epicId }: { id: string; epicId: string }) =>
      api.work.initiatives.unlinkEpic(id, epicId),
    onSuccess: () => refresh(),
  });
  return { create, update, archive, link, unlink };
}

/** The share of issues done under an initiative's visible epics, as a whole percent. */
export const percentDone = (initiative: Pick<Initiative, 'progress'>) =>
  initiative.progress.total === 0
    ? 0
    : Math.round((initiative.progress.done / initiative.progress.total) * 100);
