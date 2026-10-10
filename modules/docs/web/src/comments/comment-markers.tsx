import { Avatar, avatarHue } from '@bemmoly/ui';
import { useMemo, useRef } from 'react';
import { stackTops, useAnchorOffsets } from './anchor-layout.ts';
import type { PageEditor } from './highlights.ts';
import type { CommentThread } from './use-comments.ts';

export interface CommentMarkersProps {
  editor: PageEditor | null;
  threads: readonly CommentThread[];
  anchors: ReadonlyMap<string, number>;
  onOpen: (threadId: string) => void;
}

const MARKER_HEIGHT = 24;

/**
 * Beside each anchored line, in the page's right margin: the first commenter's face and the
 * number of comments in the thread (the kit's .d-cmk). A click opens the comments margin with
 * that thread in focus. Markers that would overlap stack downwards. Hidden on phones, where
 * the margin has no room; the header's Comments button stays.
 */
export function CommentMarkers({ editor, threads, anchors, onOpen }: CommentMarkersProps) {
  const layer = useRef<HTMLDivElement>(null);
  const offsets = useAnchorOffsets(editor, anchors, layer, [threads]);
  const placed = useMemo(() => {
    const items = threads
      .filter((thread) => offsets.has(thread.root.id))
      .map((thread) => ({
        thread,
        id: thread.root.id,
        y: offsets.get(thread.root.id)!,
        height: MARKER_HEIGHT,
      }))
      .sort((a, b) => a.y - b.y);
    const tops = stackTops(items, 4);
    return items.map((item, index) => ({ ...item, top: tops[index]! }));
  }, [threads, offsets]);

  return (
    <div
      ref={layer}
      aria-hidden={placed.length === 0}
      className="pointer-events-none absolute inset-0 max-sm:hidden"
    >
      {placed.map(({ thread, id, top }) => {
        const author = thread.root.author;
        const count = 1 + thread.replies.length;
        const name = author?.name ?? 'A former member';
        return (
          <button
            key={id}
            type="button"
            data-comment-marker={id}
            aria-label={`${count} ${count === 1 ? 'comment' : 'comments'} from ${name}. Open thread`}
            onClick={() => onOpen(id)}
            style={{ top }}
            className="pointer-events-auto absolute -right-2 inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border-0 bg-card pr-1.75 pl-0.75 font-sans text-11 leading-none font-semibold text-tx-2 tabular-nums shadow-e1 hover:text-tx focus-visible:shadow-ring focus-visible:outline-0 motion-safe:animate-fade-in"
          >
            <Avatar name={name} hue={avatarHue(author?.id ?? id)} size={18} />
            {count}
          </button>
        );
      })}
    </div>
  );
}
