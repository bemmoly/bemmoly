import type { CommentAnchor, RichText } from '@bemmoly/module-docs/shared';
import { useState } from 'react';
import { CommentBox } from './comment-box.tsx';

export interface RailComposerProps {
  /** The passage a new comment was started on, when it came from a selection. */
  draft: CommentAnchor | null;
  onSubmit: (body: RichText, anchored: boolean) => Promise<unknown>;
  onCancelDraft: () => void;
}

/**
 * The box pinned to the foot of the comments margin. It comments on the whole page; a
 * comment started from a selection shows its quote above the box and is anchored there.
 */
export function RailComposer({ draft, onSubmit, onCancelDraft }: RailComposerProps) {
  // A sent page comment remounts the box, so it is empty and ready for the next one.
  const [sent, setSent] = useState(0);
  const post = async (body: RichText) => {
    await onSubmit(body, draft !== null);
    if (!draft) setSent((count) => count + 1);
  };

  return (
    <div className="shrink-0 border-t border-line bg-canvas p-3">
      {draft ? (
        <section
          key={draft.from}
          aria-label="New comment"
          className="flex flex-col gap-1.5 rounded-control border border-amber-fg/30 bg-amber-bg/50 px-3 py-2.5 motion-safe:animate-rise"
        >
          <blockquote className="m-0 line-clamp-3 border-l-2 border-line pl-2 text-12 whitespace-pre-line text-tx-3">
            {draft.quote}
          </blockquote>
          <CommentBox label="Comment" onSubmit={post} onCancel={onCancelDraft} />
        </section>
      ) : (
        <CommentBox
          key={sent}
          label="Comment on this page"
          placeholder="Comment on the whole page…"
          autoFocus={false}
          onSubmit={post}
        />
      )}
    </div>
  );
}
