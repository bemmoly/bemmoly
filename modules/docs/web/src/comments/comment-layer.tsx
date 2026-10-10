import type { CommentAnchor } from '@bemmoly/module-docs/shared';
import { useEffect, useMemo } from 'react';
import { CommentBubble } from './comment-bubble.tsx';
import { useCommentUi, usePageCommentUi } from './comment-store.ts';
import type { PageEditor } from './highlights.ts';
import { useCommentHighlights } from './use-comment-highlights.ts';
import { usePageComments, type CommentThread } from './use-comments.ts';

export interface CommentLayerProps {
  pageId: string;
  /** The live page editor (DocEditor's onEditor); nothing shows until it exists. */
  editor: PageEditor | null;
  /** Show the comments rail: a highlight was clicked or a comment was started. */
  onOpenComments: () => void;
  /** Readers see highlights but get no Comment action. */
  canComment?: boolean;
}

const DRAFT_ID = 'draft';

/**
 * Everything comments put on the page itself, whichever rail tab is open: the amber
 * highlight under each open inline thread (stronger on the one in focus, and under the
 * text a new comment is being written about), the Comment bubble over a selection and its
 * shortcut. Clicking highlighted text focuses its thread in the rail.
 */
export function CommentLayer({
  pageId,
  editor,
  onOpenComments,
  canComment = true,
}: CommentLayerProps) {
  const ui = usePageCommentUi(pageId);
  const { threads } = usePageComments(pageId, 'open');
  const draft = ui.draft;
  const marked = useMemo<CommentThread[]>(() => {
    if (!draft) return threads;
    const root = draftComment(pageId, draft);
    return [...threads, { root, replies: [] }];
  }, [threads, draft, pageId]);

  const ranges = useCommentHighlights(
    editor,
    marked,
    draft ? DRAFT_ID : ui.active,
    ui.focusTick,
    ui.focusFrom === 'rail',
    (id) => {
      if (id === DRAFT_ID) return;
      ui.focusThread(id, 'page');
      onOpenComments();
    },
  );

  const order = [...ranges]
    .filter(([id]) => id !== DRAFT_ID)
    .sort(([, a], [, b]) => a.from - b.from)
    .map(([id]) => id)
    .join(',');
  useEffect(() => {
    useCommentUi.getState().setOrder(pageId, order ? order.split(',') : []);
  }, [pageId, order]);

  return (
    <CommentBubble
      editor={editor}
      disabled={!canComment}
      onStart={(anchor) => {
        ui.startDraft(anchor);
        onOpenComments();
      }}
    />
  );
}

/** The comment being written, as a thread the highlighter can place. */
function draftComment(pageId: string, anchor: CommentAnchor): CommentThread['root'] {
  return {
    id: DRAFT_ID,
    pageId,
    parentId: null,
    author: null,
    body: { type: 'doc' },
    bodyText: '',
    anchor,
    anchorStatus: 'anchored',
    aiSuggestion: null,
    resolvedAt: null,
    resolvedBy: null,
    editedAt: null,
    createdAt: new Date(0).toISOString(),
  };
}
