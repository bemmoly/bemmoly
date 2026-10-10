import type { PageComment, RichText } from '@bemmoly/module-docs/shared';
import { ActivityAction, AiDot } from '@bemmoly/ui';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { CommentBox } from './comment-box.tsx';
import { cx } from './cx.ts';
import { CommentItem } from './comment-item.tsx';
import type { CommentThread as Thread } from './use-comments.ts';

export interface ThreadHandlers {
  onSelect: (thread: Thread) => void;
  onReply: (root: PageComment, body: RichText) => Promise<unknown>;
  onEdit: (comment: PageComment, body: RichText) => Promise<unknown>;
  onDelete: (comment: PageComment, replies: number) => void;
  onResolve: (root: PageComment) => void;
  onReopen: (root: PageComment) => void;
  onApplyFix: (root: PageComment) => void;
}

export interface CommentThreadProps extends ThreadHandlers {
  thread: Thread;
  viewerId: string | null;
  /** The thread whose text is highlighted in the page. */
  active: boolean;
  /** Commenting needs edit rights on the page; readers see threads only. */
  canComment: boolean;
  busy?: boolean;
}

/** The quoted text an inline thread is about, with the marker when that text has changed. */
function Quote({ comment }: { comment: PageComment }) {
  if (!comment.anchor) return null;
  const changed = comment.anchorStatus === 'text_changed';
  return (
    <blockquote
      className={cx(
        'm-0 border-l-2 pl-2 text-12 leading-body text-tx-3',
        changed ? 'border-dashed border-line' : 'border-line',
      )}
    >
      {changed && (
        <span className="mr-1.5 inline-flex rounded-chip bg-line-2 px-1.25 py-px text-11 font-medium text-tx-2">
          Text changed
        </span>
      )}
      <span
        className={cx(
          'line-clamp-3 whitespace-pre-line',
          changed && 'line-through decoration-tx-3',
        )}
      >
        {comment.anchor.quote}
      </span>
    </blockquote>
  );
}

/**
 * One thread in the rail, the mock's card: br border, 7px radius, 10px 12px, the amber tint
 * when its text is in focus. The comments one under another (the first with its quote under
 * the name line), the AI fix when the thread carries one, and Apply fix · Reply · Resolve.
 * Enter or a click focuses its text.
 */
export function CommentThread({
  thread,
  viewerId,
  active,
  canComment,
  busy = false,
  ...on
}: CommentThreadProps) {
  const { root, replies } = thread;
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const resolved = root.resolvedAt !== null;
  const fix =
    root.aiSuggestion && !root.aiSuggestion.appliedAt && root.anchor ? root.aiSuggestion : null;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') on.onSelect(thread);
    if (event.key === 'r' && canComment && !resolved) {
      event.preventDefault();
      setReplying(true);
    }
  };

  const item = (comment: PageComment, count = 0, quote?: ReactNode) => (
    <CommentItem
      key={comment.id}
      comment={comment}
      quote={quote}
      mine={canComment && comment.author?.id === viewerId}
      editing={editing === comment.id}
      onEdit={() => setEditing(comment.id)}
      onCancelEdit={() => setEditing(null)}
      onSave={async (body) => {
        await on.onEdit(comment, body);
        setEditing(null);
      }}
      onDelete={() => on.onDelete(comment, count)}
    />
  );

  return (
    <article
      tabIndex={0}
      aria-label={`Comment by ${root.author?.name ?? 'a former member'}`}
      aria-current={active || undefined}
      data-thread={root.id}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('button, a, [contenteditable=true]')) {
          on.onSelect(thread);
        }
      }}
      className={cx(
        'flex cursor-default flex-col gap-1.5 rounded-control border px-3 py-2.5 text-13 leading-body outline-0',
        'motion-safe:animate-rise motion-safe:transition-colors focus-visible:border-acc',
        active ? 'border-line bg-amber-bg/50' : 'border-line bg-card',
        resolved && 'opacity-80',
      )}
    >
      {item(root, replies.length, <Quote comment={root} />)}
      {replies.length > 0 && (
        <div className="mt-1 flex flex-col gap-2.5 border-t border-line-2 pt-2.5">
          {replies.map((reply) => item(reply))}
        </div>
      )}
      {fix && !resolved && (
        <div className="mt-0.5 flex items-start gap-2 rounded-chip border border-ai-100 bg-ai-50 p-2">
          <AiDot className="mt-1.5" />
          <span className="min-w-0 text-tx">
            {fix.rationale ? `${fix.rationale} ` : ''}Replace with “{fix.replacement}”?
          </span>
        </div>
      )}
      {replying && (
        <CommentBox
          label="Reply"
          placeholder="Reply…"
          submitLabel="Reply"
          onSubmit={async (body) => {
            await on.onReply(root, body);
            setReplying(false);
          }}
          onCancel={() => setReplying(false)}
        />
      )}
      {canComment && !replying && (
        <div className="flex items-center gap-2.5 pt-0.5 font-medium">
          {fix && !resolved && (
            <ActivityAction
              disabled={busy}
              className="font-medium text-ai-600! hover:text-tx!"
              onClick={() => on.onApplyFix(root)}
            >
              Apply fix
            </ActivityAction>
          )}
          {!resolved && (
            <ActivityAction className="font-medium" onClick={() => setReplying(true)}>
              Reply
            </ActivityAction>
          )}
          <ActivityAction
            disabled={busy}
            className="ml-auto font-medium"
            onClick={() => (resolved ? on.onReopen(root) : on.onResolve(root))}
          >
            {resolved ? 'Reopen' : 'Resolve'}
          </ActivityAction>
        </div>
      )}
    </article>
  );
}
