import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useRecordRecent } from '@bemmoly/core-web';
import { cx } from './cx.ts';
import type { PageDetail } from '../../../shared/pages.ts';
import { useCollabPage } from '../collab/use-collab-page.ts';
import { useCollabUser } from '../collab/use-collab-user.ts';
import { useLocalSync } from '../collab/use-local-sync.ts';
import { useDocStats } from './body/doc-stats.ts';
import { PageBanner } from './body/page-banner.tsx';
import { EmptyPageTemplates } from '../create/empty-page-templates.tsx';
import { ExportDialogHost } from '../transfer/export-dialog.tsx';
import { PageBodyEditor } from './body/page-body-editor.tsx';
import { PageHeading } from './body/page-heading.tsx';
import { PageHeaderActions } from './header/page-header-bar.tsx';
import { StatusMenu } from './header/status-menu.tsx';
import { DocsLayout } from '../shared/docs-layout.tsx';
import { docsPaths } from '../shared/navigation.ts';
import { useSpaceActions } from '../space/space-layout.tsx';
import { PageCoverBand } from './body/page-identity.tsx';
import { DockedMargin, OverlayMargin } from './panel/page-margin.tsx';
import {
  FADE_WHILE_TYPING,
  marginShown,
  PageScreenContext,
  usePageChrome,
  type PageEditor,
  type PageScreenState,
  type ReadOnlyReason,
  useSlotProps,
} from './screen-context.ts';
import { HISTORY_SLOT, LAYER_SLOTS } from './slots.ts';
import { goToHeading, useActiveHeading, useOutline } from './toc/use-outline.ts';
import { usePageShortcuts } from './use-page-shortcuts.ts';

/**
 * The 700px column with its side padding and the 340px margin fit side by side from this
 * scroller width; below it the margin opens over the page.
 */
const DOCK_FROM = 1104;

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

/** Version history in place of the body, with Escape to leave it. */
function HistoryBody() {
  const props = useSlotProps();
  const setMode = usePageChrome((state) => state.setMode);
  const Mode = HISTORY_SLOT.Component;
  return <Mode {...props} onExit={() => setMode('page')} />;
}

function readOnlyOf(page: PageDetail, status: string): ReadOnlyReason {
  if (page.deletedAt) return 'trashed';
  if (page.status === 'archived') return 'archived';
  if (status === 'read-only' || status === 'denied') return 'viewer';
  return null;
}

/**
 * The doc editor screen in the frame's full layout: the page's trail, status and actions in the
 * one header, then the body column, the outline rail when there is room for it and the side
 * panel. A trashed page opens no live
 * document; every other page is edited live with everyone who has it open.
 */
export function PageFrame({ page }: { page: PageDetail }) {
  const user = useCollabUser();
  const collab = useCollabPage(page.deletedAt ? undefined : page.id, user, page.snapshot);
  useLocalSync(page, collab.doc, collab.status === 'local');
  const [editor, setEditor] = useState<PageEditor | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const readOnly = readOnlyOf(page, collab.status);
  const editable = !readOnly && collab.editable;
  const outline = useOutline(editor);
  const { active: activeHeading, pin: pinHeading } = useActiveHeading(scroller, editor, outline);
  const docked = useWiderThan(scroller, DOCK_FROM);
  const mode = usePageChrome((state) => state.mode);
  const history = mode === 'history' && !page.deletedAt;
  const stats = useDocStats(editor, page.wordCount);
  const margin = usePageChrome((state) => state.margin);
  const chosen = usePageChrome((state) => state.chosen);
  usePageShortcuts(collab.status, readOnly, (id) => marginShown({ margin, chosen }, id, docked));
  const panelDocked = docked && margin !== null && margin !== 'outline';
  useHashLanding(editor, outline);
  const { space } = useSpaceActions();
  useRecordRecent({
    id: `docs.page:${page.id}`,
    title: page.title || 'Untitled',
    context: space.name,
    path: docsPaths.page(page.id),
    look: { kind: 'icon', icon: 'doc', moduleId: 'docs' },
    group: 'Pages',
  });

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
      pinHeading,
      docked,
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
      pinHeading,
      docked,
      stats,
    ],
  );

  return (
    <PageScreenContext.Provider value={screen}>
      <DocsLayout layout="full" trailing={<StatusMenu />} headerClassName={FADE_WHILE_TYPING}>
        <PageHeaderActions />
        <div className="relative flex min-h-0 flex-1" data-page-id={page.id}>
          <div
            ref={scroller}
            hidden={history}
            className="min-h-0 min-w-0 flex-1 overflow-auto bg-canvas"
          >
            <PageBanner />
            <PageCoverBand />
            {/* A panel margin sits at the right edge with the column centred in what is left; the
                bare outline sits right beside the column. */}
            <div className={cx('flex min-h-full', panelDocked ? '' : 'justify-center')}>
              <div
                className={cx(
                  'flex min-w-0 justify-center',
                  panelDocked ? 'flex-1' : 'max-w-[780px] flex-1',
                )}
              >
                <article
                  className={cx(
                    'relative flex max-w-[780px] min-w-0 flex-1 flex-col gap-4.5 px-4 pb-30 text-16 leading-prose text-tx sm:px-10',
                    page.cover ? 'pt-0' : 'pt-8 sm:pt-10',
                  )}
                >
                  <PageHeading />
                  <PageBodyEditor onEditor={setEditor} />
                  <EmptyPageTemplates />
                  <ExportDialogHost />
                  <Layers />
                </article>
              </div>
              {docked && <DockedMargin />}
            </div>
          </div>
          {history && <HistoryBody />}
          {!history && <OverlayMargin />}
        </div>
      </DocsLayout>
    </PageScreenContext.Provider>
  );
}
