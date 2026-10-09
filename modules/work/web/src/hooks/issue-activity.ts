import type { CreateCommentBody, CreateWorkLogBody, RichText } from '@bemmoly/module-work/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { issueKeys } from './issue-keys.ts';

const PAGE = 100;

/** Comments, oldest first as the server pages them; threads are built from parentId. */
export function useComments(key: string) {
  return useQuery({
    queryKey: issueKeys.comments(key),
    queryFn: async () => (await api.work.comments.list(key, { limit: PAGE })).items,
  });
}

export function useHistory(key: string) {
  return useQuery({
    queryKey: issueKeys.history(key),
    queryFn: async () => (await api.work.issues.history(key, { limit: PAGE })).items,
  });
}

export function useWorkLogs(key: string) {
  return useQuery({
    queryKey: issueKeys.workLogs(key),
    queryFn: () => api.work.issues.workLogs(key),
  });
}

/** Who watches the issue, for the avatars beside the count. */
export function useWatchers(key: string) {
  return useQuery({
    queryKey: issueKeys.watchers(key),
    queryFn: () => api.work.issues.watchers(key),
  });
}

/** Posts a comment or a reply; the thread and the history read again afterwards. */
export function useAddComment(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCommentBody) => api.work.comments.create(key, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: issueKeys.comments(key) }),
  });
}

export function useEditComment(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RichText }) =>
      api.work.comments.update(id, { body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: issueKeys.comments(key) }),
  });
}

/** Toggles the viewer's reaction on a comment. */
export function useReact(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reaction, on }: { id: string; reaction: string; on: boolean }) =>
      api.work.comments.react(id, { reaction, on }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: issueKeys.comments(key) }),
  });
}

export function useLogWork(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWorkLogBody) => api.work.issues.logWork(key, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: issueKeys.workLogs(key) }),
  });
}
