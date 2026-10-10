import { Skeleton } from '@bemmoly/ui';
import { lazy, Suspense } from 'react';
import type { CommentLayerProps } from './comment-layer.tsx';
import type { CommentsRailProps } from './comments-rail.tsx';

/*
 * The comments slots the page screen mounts. Both load in their own chunk the first time a
 * page opens, so the Docs home and space screens never pay for them.
 *   <CommentLayer pageId editor onOpenComments canComment />  highlights, bubble, ⌘⌥M
 *   <CommentsRail pageId canComment />                        the side panel's Comments tab
 *   useOpenThreadCount(pageId)                                "Comments (3)" on the tab
 */

const Rail = lazy(() => import('./comments-rail.tsx').then((m) => ({ default: m.CommentsRail })));
const Layer = lazy(() => import('./comment-layer.tsx').then((m) => ({ default: m.CommentLayer })));

export function CommentsRail(props: CommentsRailProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-2 p-3.5" aria-hidden>
          <Skeleton width="60%" />
          <Skeleton width="85%" />
        </div>
      }
    >
      <Rail {...props} />
    </Suspense>
  );
}

export function CommentLayer(props: CommentLayerProps) {
  return (
    <Suspense fallback={null}>
      <Layer {...props} />
    </Suspense>
  );
}

export { useOpenThreadCount } from './use-comments.ts';
export type { PageEditor } from './highlights.ts';
export type { CommentLayerProps, CommentsRailProps };
