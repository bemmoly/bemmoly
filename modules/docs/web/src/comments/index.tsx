import { preloadable, useLoaded } from '@bemmoly/core-web';
import { Skeleton } from '@bemmoly/ui';
import { Suspense } from 'react';
import type { CommentLayerProps } from './comment-layer.tsx';
import type { CommentsRailProps } from './comments-rail.tsx';

/*
 * The comments slots the page screen mounts. Both load in their own chunk the first time a
 * page opens, so the Docs home and space screens never pay for them.
 *   <CommentLayer pageId editor onOpenComments canComment />  highlights, bubble, ⌘⌥M
 *   <CommentsRail pageId canComment />                        the side panel's Comments tab
 *   useOpenThreadCount(pageId)                                "Comments (3)" on the tab
 */

// Loaded before they render (useLoaded), so no Suspense fallback holds them back 300 ms.
const Rail = preloadable<CommentsRailProps>(() =>
  import('./comments-rail.tsx').then((m) => ({ default: m.CommentsRail })),
);
const Layer = preloadable<CommentLayerProps>(() =>
  import('./comment-layer.tsx').then((m) => ({ default: m.CommentLayer })),
);

const railSkeleton = (
  <div className="flex flex-col gap-2 p-3.5" aria-hidden>
    <Skeleton width="60%" />
    <Skeleton width="85%" />
  </div>
);

export function CommentsRail(props: CommentsRailProps) {
  const ready = useLoaded(Rail);
  return (
    <Suspense fallback={railSkeleton}>
      {ready ? <Rail.Component {...props} /> : railSkeleton}
    </Suspense>
  );
}

export function CommentLayer(props: CommentLayerProps) {
  const ready = useLoaded(Layer);
  return <Suspense fallback={null}>{ready && <Layer.Component {...props} />}</Suspense>;
}

export { useOpenThreadCount } from './use-comments.ts';
export type { PageEditor } from './highlights.ts';
export type { CommentLayerProps, CommentsRailProps };
