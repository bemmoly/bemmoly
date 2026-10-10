import type { PageComment, RichText } from '@bemmoly/module-docs/shared';
import { ActivityAction, AiDot, AiSuggestion } from '@bemmoly/ui';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { api } from '../shared/api.ts';
import { useSession } from '../shared/people.ts';
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
  /** Asks AI for a fix to the thread's text; shown only with AI on. */
  onSuggestFix: (root: PageComment) => void;
  /** The thread a fix is being written for, if any. */
  suggesting: string | null;
  /**
   * AI may work on this page for this person: on, not opted out, and the space not excluded
   * by its own switch or by Settings › AI. "Suggest a fix" shows only then.
   */
  aiAllowed: boolean;
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

/**
 * The thread's AI fix, as the system's AiSuggestion: what it would change and why, Apply fix for
 * someone who may comment, and "Not useful", which marks the run that wrote it once, for
 * Settings › AI's numbers. The fix itself stays, to apply or leave.
 */
function FixSuggestion({
  fix,
  onApply,
  busy,
}: {
  fix: NonNullable<PageComment['aiSuggestion']>;
  onApply: (() => void) | undefined;
  busy: boolean;
}) {
  const [marked, setMarked] = useState(false);
  const runId = fix.runId;
  const markNotUseful = () => {
    if (!runId) return;
    setMarked(true);
    // A failed mark changes nothing the person sees, as on every AI card.
    void api.ai.runs.feedback(runId, 'not_useful').catch(() => null);
  };
  return (
    <AiSuggestion
      variant="card"
      stacked
      className="mt-0.5"
      acceptLabel="Apply fix"
      acceptDisabled={busy}
      dismissLabel={marked ? 'Marked not useful' : 'Not useful'}
      dismissDone={marked}
      {...(onApply ? { onAccept: onApply } : {})}
      {...(runId ? { onDismiss: markNotUseful } : {})}
    >
      {fix.rationale ? `${fix.rationale} ` : ''}Replace with “{fix.replacement}”?
    </AiSuggestion>
  );
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
 * the name line), the AI fix in lilac when the thread carries one and the workspace has AI on,
 * with Apply fix on it, then Reply · Resolve.
 * Enter or a click focuses its text; R replies and E resolves (or reopens).
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
  const { aiEnabled } = useSession();
  const fix =
    aiEnabled && root.aiSuggestion && !root.aiSuggestion.appliedAt && root.anchor
      ? root.aiSuggestion
      : null;
  const writing = aiEnabled && on.suggesting === root.id;
  const canSuggest =
    aiEnabled &&
    on.aiAllowed &&
    canComment &&
    root.anchorStatus === 'anchored' &&
    !fix &&
    !writing &&
    !resolved;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') on.onSelect(thread);
    if (event.key === 'r' && canComment && !resolved) {
      event.preventDefault();
      setReplying(true);
    }
    if (event.key === 'e' && canComment && !busy) {
      event.preventDefault();
      if (resolved) on.onReopen(root);
      else on.onResolve(root);
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
        'flex cursor-default flex-col gap-1.5 rounded-card border px-3 py-2.5 text-13 leading-body outline-0',
        'motion-safe:animate-rise motion-safe:transition-colors focus-visible:shadow-ring',
        active ? 'border-amber bg-card shadow-e1' : 'border-line bg-card',
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
        <FixSuggestion
          key={fix.runId ?? fix.replacement}
          fix={fix}
          busy={busy}
          onApply={canComment ? () => on.onApplyFix(root) : undefined}
        />
      )}
      {writing && (
        <div
          role="status"
          className="mt-0.5 flex items-center gap-2 rounded-chip border border-ai-100 bg-ai-50 p-2 text-ai-600"
        >
          <AiDot />
          Writing a fix…
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
          {canSuggest && (
            <ActivityAction
              className="font-medium text-ai-600! hover:text-tx!"
              onClick={() => on.onSuggestFix(root)}
            >
              Suggest a fix
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
