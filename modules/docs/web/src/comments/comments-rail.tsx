import type { PageComment } from '@bemmoly/module-docs/shared';
import {
  Button,
  EmptyState,
  IconButton,
  SegmentedControl,
  Skeleton,
  spokenKeys,
  useToast,
} from '@bemmoly/ui';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSession } from '../shared/people.ts';
import { COMMENT_SHORTCUT } from './comment-bubble.tsx';
import { usePageCommentUi } from './comment-store.ts';
import { CommentThread } from './comment-thread.tsx';
import { ConfirmDialog } from './confirm-dialog.tsx';
import { RailComposer } from './rail-composer.tsx';
import { useThreadHandlers } from './use-thread-handlers.ts';
import {
  usePageComments,
  type CommentFilter,
  type CommentThread as Thread,
} from './use-comments.ts';

export interface CommentsRailProps {
  pageId: string;
  /** Readers (no docs.page.edit) read threads but write none. */
  canComment?: boolean;
  onClose?: () => void;
}

/** Inline threads in page order, then page-level ones and those whose text is gone, oldest first. */
export function sortThreads(threads: readonly Thread[], order: readonly string[]): Thread[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...threads].sort((a, b) => {
    const ra = rank.get(a.root.id) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.root.id) ?? Number.MAX_SAFE_INTEGER;
    return ra - rb || a.root.createdAt.localeCompare(b.root.createdAt);
  });
}

function RailSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden>
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="flex flex-col gap-2 rounded-control border border-line px-3 py-2.5"
        >
          <Skeleton width="45%" />
          <Skeleton width="90%" />
          <Skeleton width="70%" />
        </div>
      ))}
    </div>
  );
}

const NEXT = new Set(['ArrowDown', 'j']);
const PREVIOUS = new Set(['ArrowUp', 'k']);

/** ↑↓ and J K walk the thread cards in reading order, as a list's rows. */
function walkThreads(event: KeyboardEvent<HTMLElement>) {
  if (!NEXT.has(event.key) && !PREVIOUS.has(event.key)) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const cards = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-thread]')].sort(
    (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
  );
  const index = cards.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  event.preventDefault();
  cards[Math.max(0, Math.min(cards.length - 1, index + (NEXT.has(event.key) ? 1 : -1)))]?.focus();
}

/**
 * The comments margin (340px), fixed beside the page: open or resolved threads in reading
 * order in their own scroll, and a comment box pinned to the foot. A comment started from a
 * selection takes over that box with its quote. Focusing a thread highlights and scrolls to
 * its text; a click on highlighted text focuses its card here.
 * ↑↓ or J K walk the cards, R replies, E resolves with Undo.
 */
export function CommentsRail({ pageId, canComment = true, onClose }: CommentsRailProps) {
  const [filter, setFilter] = useState<CommentFilter>('open');
  const [deleting, setDeleting] = useState<{ comment: PageComment; replies: number } | null>(null);
  const comments = usePageComments(pageId, filter);
  const ui = usePageCommentUi(pageId);
  const { user } = useSession();
  const toast = useToast();
  const handlers = useThreadHandlers(pageId);
  const list = useRef<HTMLDivElement>(null);
  /** The thread just posted: focus moves to its card once it is in the list. */
  const posted = useRef<string | null>(null);
  const threads = useMemo(
    () => sortThreads(comments.threads, ui.order),
    [comments.threads, ui.order],
  );

  useEffect(() => {
    if (ui.draft) setFilter('open');
  }, [ui.draft]);

  useEffect(() => {
    if (!ui.active) return;
    const card = list.current?.querySelector<HTMLElement>(`[data-thread="${ui.active}"]`);
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [ui.active, ui.focusFrom, ui.focusTick]);

  // The box that had focus is gone once a comment posts; its card takes focus, not the page.
  const focusPosted = () => {
    if (!posted.current) return;
    const card = list.current?.querySelector<HTMLElement>(`[data-thread="${posted.current}"]`);
    if (!card) return;
    posted.current = null;
    card.focus({ preventScroll: true });
  };
  useEffect(focusPosted, [threads]);

  const create = async (body: PageComment['body'], anchored: boolean) => {
    const comment = await handlers.create.mutateAsync({
      body,
      ...(anchored && ui.draft ? { anchor: ui.draft } : {}),
    });
    posted.current = comment.id;
    setFilter('open');
    requestAnimationFrame(focusPosted);
    if (anchored) {
      ui.clearDraft();
      ui.focusThread(comment.id);
    }
  };

  const openCount = filter === 'open' ? threads.length : undefined;
  const renderThread = (thread: Thread) => (
    <CommentThread
      key={thread.root.id}
      thread={thread}
      viewerId={user?.id ?? null}
      active={ui.active === thread.root.id}
      canComment={canComment}
      busy={handlers.busy}
      {...handlers.thread}
      onSelect={(selected) => ui.focusThread(selected.root.id)}
      onDelete={(comment, replies) => setDeleting({ comment, replies })}
    />
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col text-13 leading-body">
      <div className="flex h-11.5 shrink-0 items-center gap-2 border-b border-line bg-canvas pr-2.5 pl-4">
        <h2 className="m-0 text-13 font-semibold text-tx">Comments</h2>
        <SegmentedControl
          size="sm"
          aria-label="Show comments"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: openCount === undefined ? 'Open' : `Open (${openCount})` },
            { value: 'resolved', label: 'Resolved' },
          ]}
        />
        <span className="ml-auto flex items-center gap-1">
          {onClose && (
            <IconButton
              label="Close comments"
              keys="Mod+Alt+C"
              icon="close"
              size="xs"
              variant="ghost"
              onClick={onClose}
            />
          )}
        </span>
      </div>
      <div
        ref={list}
        onKeyDown={walkThreads}
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3.5"
      >
        {comments.isPending ? (
          <RailSkeleton />
        ) : comments.isError ? (
          <EmptyState
            size="sm"
            title="Comments could not be loaded"
            description="Check your connection and try again."
            action={
              <Button size="sm" onClick={() => void comments.refetch()}>
                Try again
              </Button>
            }
          />
        ) : threads.length === 0 ? (
          <EmptyState
            size="sm"
            title={filter === 'open' ? 'No open comments' : 'No resolved comments'}
            description={
              filter === 'open' && canComment
                ? `Write one below, or select text in the page and choose Comment (${spokenKeys(COMMENT_SHORTCUT)}).`
                : 'Resolved threads are kept here.'
            }
          />
        ) : (
          threads.map(renderThread)
        )}
      </div>
      {canComment && (
        <RailComposer draft={ui.draft} onSubmit={create} onCancelDraft={ui.clearDraft} />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={deleting?.comment.parentId ? 'Delete this reply?' : 'Delete this comment?'}
        confirmLabel="Delete"
        tone="danger"
        busy={handlers.remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          handlers.remove.mutate(deleting.comment.id, {
            onSuccess: () => setDeleting(null),
            onError: (error) =>
              toast.show({ tone: 'danger', title: 'Not deleted', body: error.message }),
          });
        }}
      >
        {deleting && deleting.replies > 0
          ? `The thread and its ${deleting.replies} ${deleting.replies === 1 ? 'reply' : 'replies'} are deleted for everyone.`
          : 'It is deleted for everyone on the page.'}
      </ConfirmDialog>
    </div>
  );
}
