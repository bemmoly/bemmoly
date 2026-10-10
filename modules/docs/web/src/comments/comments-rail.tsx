import type { PageComment } from '@bemmoly/module-docs/shared';
import { Icon } from '@bemmoly/ui/icons';
import { Button, EmptyState, SegmentedControl, Skeleton, spokenKeys, useToast } from '@bemmoly/ui';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSession } from '../shared/people.ts';
import { CommentBox } from './comment-box.tsx';
import { COMMENT_SHORTCUT } from './comment-bubble.tsx';
import { usePageCommentUi } from './comment-store.ts';
import { CommentThread } from './comment-thread.tsx';
import { ConfirmDialog } from './confirm-dialog.tsx';
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

/** Arrow keys walk the thread cards, as a list's rows. */
function walkThreads(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const cards = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-thread]')];
  const index = cards.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  event.preventDefault();
  cards[
    Math.max(0, Math.min(cards.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
  ]?.focus();
}

/**
 * The Comments tab of the Doc Editor's side panel (340px): open or resolved threads, a new
 * comment's draft on top when one was started from a selection, and a page-level comment.
 * Threads follow the page's reading order. Focusing a thread highlights and scrolls to its
 * text; a click on highlighted text in the page focuses its card here.
 */
export function CommentsRail({ pageId, canComment = true }: CommentsRailProps) {
  const [filter, setFilter] = useState<CommentFilter>('open');
  const [general, setGeneral] = useState(false);
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
    requestAnimationFrame(focusPosted);
    if (anchored) {
      ui.clearDraft();
      ui.focusThread(comment.id);
    } else setGeneral(false);
  };

  const openCount = filter === 'open' ? threads.length : undefined;
  return (
    <div className="flex min-h-0 flex-1 flex-col text-13 leading-body">
      <div className="flex shrink-0 items-center gap-2 px-3.5 pt-3.5">
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
        {canComment && !general && (
          <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setGeneral(true)}>
            <Icon name="plus" size={14} />
            Comment
          </Button>
        )}
      </div>
      <div
        ref={list}
        onKeyDown={walkThreads}
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3.5"
      >
        {ui.draft && canComment && (
          <section
            aria-label="New comment"
            className="flex flex-col gap-1.5 rounded-control border border-amber-fg/30 bg-amber-bg/50 px-3 py-2.5 motion-safe:animate-rise"
          >
            <blockquote className="m-0 line-clamp-3 border-l-2 border-line pl-2 text-12 whitespace-pre-line text-tx-3">
              {ui.draft.quote}
            </blockquote>
            <CommentBox
              label="Comment"
              onSubmit={(body) => create(body, true)}
              onCancel={ui.clearDraft}
            />
          </section>
        )}
        {general && (
          <CommentBox
            label="Comment on this page"
            placeholder="Comment on the whole page…"
            onSubmit={(body) => create(body, false)}
            onCancel={() => setGeneral(false)}
          />
        )}
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
        ) : threads.length === 0 && !ui.draft ? (
          <EmptyState
            size="sm"
            title={filter === 'open' ? 'No open comments' : 'No resolved comments'}
            description={
              filter === 'open' && canComment
                ? `Select text in the page and choose Comment, or press ${spokenKeys(COMMENT_SHORTCUT)}.`
                : 'Resolved threads are kept here.'
            }
          />
        ) : (
          threads.map((thread) => (
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
          ))
        )}
      </div>
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
