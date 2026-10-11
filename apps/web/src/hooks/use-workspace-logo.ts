import { queryKeys } from '@bemmoly/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { customerLogo } from '../lib/customer-logo.ts';
import { describeError } from '../lib/errors.ts';
import { logoFileProblem } from '../lib/logo-file.ts';
import { toast, undoToast } from '../lib/toast.ts';
import { useMe } from './use-session.ts';
import { settingsQuery } from './use-setting.ts';
import { useWorkspace } from './use-workspace.ts';

/**
 * Settings › Appearance › Logo: the workspace's own logo, saved as soon as it is chosen (it is
 * not part of the theme draft). Remove offers Undo, which points the setting back at the stored
 * logo; the server keeps its bytes.
 */
export function useWorkspaceLogo() {
  const queryClient = useQueryClient();
  const canManage = useMe().can('workspace.appearance.manage');
  const workspace = useWorkspace();
  const logo = customerLogo(workspace.name, workspace.appearance.logoKey);
  const [error, setError] = useState<string | null>(null);
  /** The stored key itself, which Undo writes back; /me may carry the logo in another form. */
  const stored = useQuery(settingsQuery(['appearance.logoKey'])).data?.['appearance.logoKey'].value;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.me() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.setupStatus() }),
    ]);

  const upload = useMutation({
    mutationFn: (file: Blob) => api.appearance.logo.upload(file),
    onSuccess: async () => {
      setError(null);
      await refresh();
      toast(logo ? 'Logo replaced' : 'Logo added');
    },
    onError: (failure) => setError(describeError(failure).message),
  });

  const restore = useMutation({
    mutationFn: (logoKey: string) => api.settings.put('appearance.logoKey', logoKey),
    onSuccess: refresh,
    onError: (failure) => toast(describeError(failure).message, 'danger'),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const previous = stored ?? null;
      await api.appearance.logo.remove();
      return previous;
    },
    onSuccess: async (previous) => {
      setError(null);
      await refresh();
      if (previous) undoToast('Logo removed', () => restore.mutate(previous));
      else toast('Logo removed');
    },
    onError: (failure) => toast(describeError(failure).message, 'danger'),
  });

  /** Checks the file the way the server will, and sends it only when it passes. */
  const choose = async (file: File) => {
    setError(null);
    const problem = await logoFileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    upload.mutate(file);
  };

  return {
    canManage,
    workspaceName: workspace.name,
    logo,
    error,
    busy: upload.isPending || remove.isPending || restore.isPending,
    choose,
    remove: () => remove.mutate(),
  };
}

export type WorkspaceLogoState = ReturnType<typeof useWorkspaceLogo>;
