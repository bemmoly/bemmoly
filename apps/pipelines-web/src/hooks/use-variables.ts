import type { SetVariableBody } from '@bemmoly/module-pipelines/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { variablesKeys, type VariableAt } from '../api/variables.ts';
import { api } from '../lib/api.ts';

export function useVariables(application: string) {
  return useQuery({
    queryKey: variablesKeys.list(application),
    queryFn: () => api.variables.list(application),
    enabled: application.length > 0,
  });
}

/** Set and delete; each write refreshes the list, since a shared value shows in every column. */
export function useVariableWrites(application: string) {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: variablesKeys.list(application) });
  return {
    set: useMutation({
      mutationFn: ({ at, body }: { at: VariableAt; body: SetVariableBody }) =>
        api.variables.set(at, body),
      onSettled: settle,
    }),
    remove: useMutation({
      mutationFn: (at: VariableAt) => api.variables.remove(at),
      onSettled: settle,
    }),
  };
}
