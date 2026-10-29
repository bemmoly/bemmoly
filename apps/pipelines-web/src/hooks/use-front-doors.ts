import type { RuntimeMove, SetFrontDoorBody } from '@bemmoly/module-pipelines/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { frontDoorKeys, type MoveVerb } from '../api/front-doors.ts';
import { runtimeKeys } from '../api/runtimes.ts';
import { api } from '../lib/api.ts';

const LIVE: ReadonlyArray<RuntimeMove['state']> = ['deploying', 'warming', 'shifting', 'holding'];

/** Front doors, with only one application's routes when it is named; polled while applying. */
export function useFrontDoors(application?: string) {
  return useQuery({
    queryKey: frontDoorKeys.list(application),
    queryFn: () => api.frontDoors.list(application),
    refetchInterval: (query) =>
      query.state.data?.items.some((door) => ['pending', 'applying'].includes(door.status))
        ? 3_000
        : false,
  });
}

/** Turning a front door on or off; every front door view and runtime card refreshes. */
export function useSetFrontDoor() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ environment, body }: { environment: string; body: SetFrontDoorBody }) =>
      api.frontDoors.set(environment, body),
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: frontDoorKeys.all }),
        client.invalidateQueries({ queryKey: ['pipelines', 'runtimes'] }),
      ]),
  });
}

/** One move, polled while it is moving so the steps and the share follow it. */
export function useMove(id: string) {
  return useQuery({
    queryKey: frontDoorKeys.move(id),
    queryFn: () => api.frontDoors.move(id),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data && LIVE.includes(query.state.data.state) ? 5_000 : false,
  });
}

/** Start, Pause, Continue and Roll back; the answer is the move as it is now. */
export function useMoveAction(id: string, application: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (verb: MoveVerb) => api.frontDoors.act(id, verb),
    onSuccess: (move) => client.setQueryData(frontDoorKeys.move(id), move),
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: runtimeKeys.runtimes(application) }),
        client.invalidateQueries({ queryKey: frontDoorKeys.all }),
      ]),
  });
}
