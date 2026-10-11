import { queryKeys } from '@bemmoly/api-client';
import type { AiStatusResponse } from '@bemmoly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { toast, undoToast } from '../lib/toast.ts';

/**
 * A person's own AI switch, shown only while the workspace has AI on and the admin lets
 * people opt out. Turning it off hides every AI surface for them at once (/me's aiEnabled
 * follows), with Undo.
 */
export function useAiOptOut() {
  const client = useQueryClient();
  const status = useQuery({ queryKey: queryKeys.ai.status(), queryFn: () => api.ai.status() });
  const mutation = useMutation({
    mutationFn: (optedOut: boolean) => api.ai.setOptOut(optedOut),
    onMutate: async (optedOut) => {
      await client.cancelQueries({ queryKey: queryKeys.ai.status() });
      const before = client.getQueryData<AiStatusResponse>(queryKeys.ai.status());
      if (before) client.setQueryData(queryKeys.ai.status(), { ...before, optedOut });
      return { before };
    },
    onError: (error, _value, context) => {
      if (context?.before) client.setQueryData(queryKeys.ai.status(), context.before);
      toast(describeError(error).message, 'danger');
    },
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.ai.status() }),
        client.invalidateQueries({ queryKey: queryKeys.me() }),
        client.invalidateQueries({ queryKey: queryKeys.settings.all() }),
      ]);
    },
  });
  const data = status.data;
  const set = (useAi: boolean) =>
    mutation.mutate(!useAi, {
      onSuccess: () =>
        undoToast(useAi ? 'AI features on for you' : 'AI features off for you', () =>
          mutation.mutate(useAi),
        ),
    });
  return {
    /** Draw the row at all: AI on for the workspace and opting out allowed. */
    shown: Boolean(data?.enabled && data.optOutAllowed),
    useAi: data ? !data.optedOut : true,
    set,
    pending: mutation.isPending,
  };
}
