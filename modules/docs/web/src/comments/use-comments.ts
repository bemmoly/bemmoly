import type { CommentAnchor, PageComment, RichText } from '@bemmoly/module-docs/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';

/*
 * A page's comments, as threads: a root (inline when it carries an anchor) and its replies,
 * one level deep. Every write settles by refetching the page's comment lists; the
 * docs.comments event does the same in every other tab.
 */

export type CommentFilter = 'open' | 'resolved';

export interface CommentThread {
  root: PageComment;
  replies: PageComment[];
}

/** Roots in the order they were written, each with its replies in order. */
export function threadsOf(comments: readonly PageComment[]): CommentThread[] {
  const byRoot = new Map<string, CommentThread>();
  for (const comment of comments) {
    if (!comment.parentId) byRoot.set(comment.id, { root: comment, replies: [] });
  }
  for (const comment of comments) {
    if (comment.parentId) byRoot.get(comment.parentId)?.replies.push(comment);
  }
  return [...byRoot.values()];
}

export function usePageComments(pageId: string, filter: CommentFilter) {
  const resolved = filter === 'resolved';
  const query = useQuery({
    queryKey: docsKeys.comments(pageId, resolved),
    queryFn: () => api.docs.comments.list(pageId, { resolved }),
    staleTime: 30_000,
  });
  const threads = useMemo(() => threadsOf(query.data?.items ?? []), [query.data]);
  return { ...query, threads };
}

/** Open threads on the page, for the tab label ("Comments (3)"). */
export function useOpenThreadCount(pageId: string): number | undefined {
  const { data } = useQuery({
    queryKey: docsKeys.comments(pageId, false),
    queryFn: () => api.docs.comments.list(pageId, { resolved: false }),
    staleTime: 30_000,
  });
  return data ? data.items.filter((comment) => !comment.parentId).length : undefined;
}

export interface NewComment {
  body: RichText;
  parentId?: string;
  anchor?: CommentAnchor;
}

/** Every write on a page's comments, each refetching the lists when it lands. */
export function useCommentActions(pageId: string) {
  const queryClient = useQueryClient();
  const settle = () =>
    queryClient.invalidateQueries({ queryKey: [...docsKeys.all(), 'comments', pageId] });
  const options = { onSettled: settle };

  const create = useMutation({
    mutationFn: (input: NewComment) => api.docs.comments.create(pageId, input),
    onSuccess: (comment) => {
      queryClient.setQueryData(docsKeys.comments(pageId, false), (current: unknown) => {
        const list = current as { items: PageComment[]; nextCursor: string | null } | undefined;
        return list && !list.items.some((item) => item.id === comment.id)
          ? { ...list, items: [...list.items, comment] }
          : list;
      });
    },
    ...options,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: RichText }) =>
      api.docs.comments.update(id, { body }),
    ...options,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.docs.comments.remove(id),
    ...options,
  });
  const resolve = useMutation({
    mutationFn: (id: string) => api.docs.comments.resolve(id),
    ...options,
  });
  const reopen = useMutation({
    mutationFn: (id: string) => api.docs.comments.reopen(id),
    ...options,
  });
  const applyFix = useMutation({
    mutationFn: (id: string) => api.docs.comments.applySuggestion(id),
    onSettled: () => {
      void settle();
      void queryClient.invalidateQueries({ queryKey: docsKeys.page(pageId) });
    },
  });
  return { create, update, remove, resolve, reopen, applyFix };
}

export type CommentActions = ReturnType<typeof useCommentActions>;
