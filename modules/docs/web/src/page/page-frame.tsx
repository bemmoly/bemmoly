import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { PageDetail } from '../../../shared/pages.ts';
import { useCollabPage } from '../collab/use-collab-page.ts';
import { useCollabUser } from '../collab/use-collab-user.ts';
import { useDocStats } from './body/doc-stats.ts';
import { PageBanner } from './body/page-banner.tsx';
import { PageBodyEditor } from './body/page-body-editor.tsx';
import { PageHeading } from './body/page-heading.tsx';
import { PageHeaderBar } from './header/page-header-bar.tsx';
import { PagePanel } from './panel/page-panel.tsx';
import {
  PageScreenContext,
  type PageEditor,
  type PageScreenState,
  type ReadOnlyReason,
  useSlotProps,
} from './screen-context.ts';
import { LAYER_SLOTS } from './slots.ts';
import { TocList } from './toc/toc-list.tsx';
import { goToHeading, useActiveHeading, useOutline } from './toc/use-outline.ts';
import { usePageShortcuts } from './use-page-shortcuts.ts';

/** The body column (720px) and an outline rail beside it fit from this scroller width. */
const RAIL_FROM = 1080;

function useWiderThan(ref: RefObject<HTMLElement | null>, width: number): boolean {
  const [wide, setWide] = useState(false);
  // Measured before the first paint, so the rail is there (or not) from the start.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    setWide(element.getBoundingClientRect().width >= width);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWide(entry.contentRect.width >= width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, width]);
  return wide;
}

/** A link to #heading lands on it once the document has its headings. */
function useHashLanding(editor: PageEditor | null, outline: PageScreenState['outline']) {
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || !editor || outline.length === 0) return;
    const hash = decodeURIComponent(window.location.hash.slice(1));
    landed.current = true;
    const entry = hash ? outline.find((item) => item.id === hash) : undefined;
    if (entry) goToHeading(editor, entry);
  }, [editor, outline]);
}

/** The body's layers from slots.ts: highlights and bubbles other folders draw on the page. */
function Layers() {
  const props = useSlotProps();
  return LAYER_SLOTS.map((Layer, index) => <Layer key={index} {...props} />);
}

function readOnlyOf(page: PageDetail, status: string): ReadOnlyReason {
  if (page.deletedAt) return 'trashed';
  if (page.status === 'archived') return 'archived';
  if (status === 'read-only' || status === 'denied') return 'viewer';
  return null;
}

/**
 * The doc editor screen inside the space layout: the header bar over the body column, the
 * outline rail when there is room for it and the side panel. A trashed page opens no live
 * document; every other page is edited live with everyone who has it open.
 */
export function PageFrame({ page }: { page: PageDetail }) {
  const user = useCollabUser();
  const collab = useCollabPage(page.deletedAt ? undefined : page.id, user, page.snapshot);
  const [editor, setEditor] = useState<PageEditor | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const readOnly = readOnlyOf(page, collab.status);
  const editable = !readOnly && collab.editable;
  const outline = useOutline(editor);
  const activeHeading = useActiveHeading(scroller, editor, outline);
  const outlineInRail = useWiderThan(scroller, RAIL_FROM);
  const stats = useDocStats(editor, page.wordCount);
  usePageShortcuts(collab.status, readOnly);
  useHashLanding(editor, outline);

  // Focus moves at once, not on the next frame as Tiptap's focus() does: a fast typist's next
  // key after Enter in the title must land in the body.
  const focusBody = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.focus();
    editor.chain().setTextSelection(1).scrollIntoView().run();
  }, [editor]);

  const screen = useMemo<PageScreenState>(
    () => ({
      page,
      collab,
      editable,
      readOnly,
      editor,
      focusBody,
      outline,
      activeHeading,
      outlineInRail,
      stats,
    }),
    [
      page,
      collab,
      editable,
      readOnly,
      editor,
      focusBody,
      outline,
      activeHeading,
      outlineInRail,
      stats,
    ],
  );

  return (
    <PageScreenContext.Provider value={screen}>
      <div className="relative flex min-h-0 flex-1 flex-col" data-page-id={page.id}>
        <PageHeaderBar />
        <div className="relative flex min-h-0 flex-1">
          <div ref={scroller} className="min-h-0 min-w-0 flex-1 overflow-auto bg-sf">
            <PageBanner />
            <div className="flex justify-center gap-8">
              <article className="flex max-w-180 min-w-0 flex-1 flex-col gap-4.5 px-4 pt-8 pb-30 text-15h leading-prose text-tx-body sm:px-10 sm:pt-12">
                <PageHeading />
                <PageBodyEditor onEditor={setEditor} />
                <Layers />
              </article>
              {/* The rail keeps its width while empty, so the body never shifts when headings arrive. */}
              {outlineInRail && (
                <aside className="sticky top-0 w-52 shrink-0 self-start pt-12 pr-6">
                  <TocList outline={outline} active={activeHeading} editor={editor} />
                </aside>
              )}
            </div>
          </div>
          <PagePanel />
        </div>
      </div>
    </PageScreenContext.Provider>
  );
}
