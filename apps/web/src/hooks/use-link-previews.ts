import { queryKeys } from '@bemmoly/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { settingsQuery, type SettingReads } from './use-setting.ts';

const KEYS = ['workspace.linkPreviews'] as const;

/**
 * Settings › General › Sharing: whether a shared link's preview names its page or issue. The
 * switch applies at once, optimistically, and rolls back if the server refuses it.
 */
export function useLinkPreviews() {
  const queryClient = useQueryClient();
  const options = settingsQuery(KEYS);
  const query = useQuery(options);
  const enabled = query.data?.['workspace.linkPreviews'].value ?? true;

  const mutation = useMutation({
    mutationFn: (on: boolean) => api.settings.put('workspace.linkPreviews', on),
    onMutate: async (on) => {
      await queryClient.cancelQueries({ queryKey: options.queryKey });
      const before = queryClient.getQueryData<SettingReads<(typeof KEYS)[number]>>(
        options.queryKey,
      );
      if (before) {
        queryClient.setQueryData(options.queryKey, {
          'workspace.linkPreviews': { ...before['workspace.linkPreviews'], value: on },
        });
      }
      return { before };
    },
    onError: (error, _, context) => {
      if (context?.before) queryClient.setQueryData(options.queryKey, context.before);
      toast(`Couldn’t save the change. ${describeError(error).message}`, 'danger');
    },
    onSuccess: (_, on) =>
      toast(on ? 'Link previews show titles' : 'Link previews no longer show titles'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings.all() }),
  });

  return {
    loading: query.isPending,
    enabled,
    setEnabled: (on: boolean) => mutation.mutate(on),
    pending: mutation.isPending,
  };
}
