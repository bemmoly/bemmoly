import type { ComponentType } from 'react';
import { CommentLayer, CommentsRail, useOpenThreadCount } from '../comments/index.tsx';
import { HistoryPanel } from '../history/index.tsx';
import { BacklinksSection } from '../links/index.ts';
import type { PageSlotProps, PanelSlot } from '../page/slots.ts';
import { ExportMenuItems } from '../transfer/index.ts';

/*
 * The comments, history, links and export parts as the page screen's slots. page/slots.ts
 * lists these; nothing here reaches into the screen beyond the slot props.
 */

/** The mock's "Comments (3)" tab: open threads, with the rail behind it. */
export const COMMENTS_PANEL: PanelSlot = {
  id: 'comments',
  label: 'Comments',
  useCount: (page) => useOpenThreadCount(page.id),
  Component: ({ page, editable }) => <CommentsRail pageId={page.id} canComment={editable} />,
};

/** The mock's "Linked work" tab: issues referenced, referenced in, backlinks. */
export const LINKED_PANEL: PanelSlot = {
  id: 'linked',
  label: 'Linked work',
  Component: ({ page }) => (
    <div className="p-3.5 text-12h leading-body">
      <BacklinksSection pageId={page.id} />
    </div>
  ),
};

/** Version history: no tab of its own until opened from the More menu. */
export const HISTORY_PANEL: PanelSlot = {
  id: 'history',
  label: 'History',
  tab: false,
  menu: { icon: 'restore', label: 'Version history' },
  Component: ({ page, editable }) => <HistoryPanel pageId={page.id} canEdit={editable} />,
};

/** Export rows in the More menu. */
export const EXPORT_MENU: ComponentType<PageSlotProps> = ({ page }) => (
  <ExportMenuItems page={page} />
);

/** Highlights, the Comment bubble and ⌘⌥M on the body. */
export const COMMENT_LAYER: ComponentType<PageSlotProps> = ({
  page,
  editable,
  editor,
  openPanel,
}) => (
  <CommentLayer
    pageId={page.id}
    editor={editor}
    canComment={editable}
    onOpenComments={() => openPanel(COMMENTS_PANEL.id)}
  />
);
