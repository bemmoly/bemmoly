import { IconButton } from '@bemmoly/ui';
import type { ComponentType } from 'react';
import { CommentLayer, CommentsRail, useOpenThreadCount } from '../comments/index.tsx';
import { HistoryMode } from '../history/index.tsx';
import { BacklinksSection } from '../links/index.ts';
import type { MarginSlot, ModeSlot, PageSlotProps } from '../page/slots.ts';
import { ExportMenuItems } from '../transfer/index.ts';

/*
 * The comments, history, links and export parts as the page screen's slots. page/slots.ts
 * lists these; nothing here reaches into the screen beyond the slot props.
 */

/** Comments in the margin, with the open thread count on the header toggle. */
export const COMMENTS_MARGIN: MarginSlot = {
  id: 'comments',
  label: 'Comments',
  icon: 'message',
  keys: 'Mod+Alt+C',
  useCount: (page) => useOpenThreadCount(page.id),
  Component: ({ page, editable, editor, docked, onClose }) => (
    <CommentsRail
      pageId={page.id}
      canComment={editable}
      onClose={onClose}
      {...(docked ? { alignTo: editor } : {})}
    />
  ),
};

/** Linked work in the margin: issues and pages that link here. */
export const LINKED_MARGIN: MarginSlot = {
  id: 'linked',
  label: 'Linked work',
  icon: 'link',
  keys: 'Mod+Alt+L',
  Component: ({ page, docked, onClose }) => (
    <div className="flex flex-col">
      <div
        className={`flex h-11.5 shrink-0 items-center gap-2 border-b border-line bg-canvas pr-2.5 pl-4 ${docked ? 'sticky top-0 z-10' : ''}`}
      >
        <h2 className="m-0 flex-1 text-13 font-semibold text-tx">Linked work</h2>
        <IconButton
          label="Close linked work"
          keys="Mod+Alt+L"
          icon="close"
          size="xs"
          variant="ghost"
          onClick={onClose}
        />
      </div>
      <div className="p-3.5 text-13 leading-body">
        <BacklinksSection pageId={page.id} />
      </div>
    </div>
  ),
};

/** Version history as a mode of the page: the diff in the column, versions in the margin. */
export const HISTORY_MODE: ModeSlot = {
  label: 'Version history',
  icon: 'clock',
  keys: 'Mod+Alt+H',
  Component: ({ page, editable, onExit }) => (
    <HistoryMode pageId={page.id} canEdit={editable} onExit={onExit} />
  ),
};

/** Export rows in the More menu. */
export const EXPORT_MENU: ComponentType<PageSlotProps> = ({ page }) => (
  <ExportMenuItems page={page} />
);

/** Highlights, markers, the Comment bubble and ⌘⌥M on the body. */
export const COMMENT_LAYER: ComponentType<PageSlotProps> = ({
  page,
  editable,
  editor,
  margin,
  openMargin,
}) => (
  <CommentLayer
    pageId={page.id}
    editor={editor}
    canComment={editable}
    markers={margin !== 'comments'}
    onOpenComments={() => openMargin('comments')}
  />
);
