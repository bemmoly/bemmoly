import { ApiError } from '@bemmoly/api-client';
import { useToast } from '@bemmoly/ui';
import type { ThreadHandlers } from './comment-thread.tsx';
import { useCommentActions } from './use-comments.ts';

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Try again in a moment.';

/**
 * The rail's actions on threads, with what to say when one fails. Resolve happens at once
 * and offers Undo, which reopens the thread. A fix whose text moved
 * on (409) says so plainly: someone edited those words after the fix was suggested.
 */
export function useThreadHandlers(pageId: string) {
  const actions = useCommentActions(pageId);
  const toast = useToast();
  const fail = (title: string) => (error: unknown) =>
    toast.show({ tone: 'danger', title, body: messageOf(error) });

  const thread: Omit<ThreadHandlers, 'onSelect' | 'onDelete'> = {
    onReply: (root, body) => actions.create.mutateAsync({ body, parentId: root.id }),
    onEdit: (comment, body) => actions.update.mutateAsync({ id: comment.id, body }),
    onResolve: (root) =>
      actions.resolve.mutate(root.id, {
        onSuccess: () =>
          toast.undo({
            title: 'Thread resolved',
            onUndo: () =>
              actions.reopen.mutate(root.id, { onError: fail('The thread was not reopened') }),
          }),
        onError: fail('The thread was not resolved'),
      }),
    onReopen: (root) =>
      actions.reopen.mutate(root.id, { onError: fail('The thread was not reopened') }),
    onApplyFix: (root) =>
      actions.applyFix.mutate(root.id, {
        onSuccess: () => toast.show({ tone: 'ok', title: 'Fix applied and thread resolved' }),
        onError: (error) =>
          error instanceof ApiError && error.status === 409
            ? toast.show({
                tone: 'warn',
                title: 'The text changed since this fix was suggested',
                body: 'Edit the page by hand, or reply to the thread.',
              })
            : fail('The fix was not applied')(error),
      }),
  };

  return {
    thread,
    create: actions.create,
    remove: actions.remove,
    busy: actions.resolve.isPending || actions.reopen.isPending || actions.applyFix.isPending,
  };
}
