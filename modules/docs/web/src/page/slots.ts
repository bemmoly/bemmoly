import type { IconName } from '@bemmoly/ui/icons';
import type { ComponentType } from 'react';
import type { PageDetail } from '../../../shared/pages.ts';
import {
  COMMENT_LAYER,
  COMMENTS_MARGIN,
  EXPORT_MENU,
  HISTORY_MODE,
  LINKED_MARGIN,
} from '../page-slots/index.tsx';
import type { MarginId, PageEditor } from './screen-context.ts';
import { OUTLINE_MARGIN } from './toc/outline-margin.tsx';

/*
 * Where other parts of the Docs module plug into the page screen, as lists the screen reads.
 * Comments, version history, backlinks and export live in their own folders and join the
 * screen by adding an entry here; the screen itself does not change.
 */

/** What every slot is drawn with. */
export interface PageSlotProps {
  page: PageDetail;
  /** Whether the person may change the page right now (not archived, trashed or read-only). */
  editable: boolean;
  /** The live body's editor once it is up; null before, and for a trashed page. */
  editor: PageEditor | null;
  /** What the right margin shows, or null while it is closed. */
  margin: MarginId | null;
  /** Shows a margin: "comments" when a highlight is clicked, say. */
  openMargin: (id: MarginId) => void;
}

/** What a margin is drawn with: docked beside the page it scrolls with it. */
export interface MarginProps extends PageSlotProps {
  /** True beside the page (wide screens); false over it, from the right. */
  docked: boolean;
  onClose: () => void;
}

/**
 * One view of the right margin, chosen from its header toggle: the outline, the comments,
 * the linked work. One shows at a time.
 */
export interface MarginSlot {
  id: MarginId;
  /** The toggle's name and the margin's: "Comments". */
  label: string;
  icon: IconName;
  /** Its shortcut, for the tooltip and the page's key handler: "Mod+Alt+C". */
  keys: string;
  /** The number on the toggle, as the review's "Comments 3". */
  useCount?: (page: PageDetail) => number | undefined;
  /** Drawn bare in the margin (the outline), rather than as a 340px panel. */
  bare?: boolean;
  Component: ComponentType<MarginProps>;
}

/** The margin's views, in header order. */
export const MARGIN_SLOTS: readonly MarginSlot[] = [OUTLINE_MARGIN, COMMENTS_MARGIN, LINKED_MARGIN];

/** A mode that takes the body's place: version history. */
export interface ModeSlot {
  label: string;
  icon: IconName;
  keys: string;
  Component: ComponentType<PageSlotProps & { onExit: () => void }>;
}

export const HISTORY_SLOT: ModeSlot = HISTORY_MODE;

/**
 * Rows of the More menu between the built-in actions and Move to trash: export, for one.
 * Each renders MenuItem elements; it may use hooks and returns null to hide itself.
 */
export const MENU_SLOTS: readonly ComponentType<PageSlotProps>[] = [EXPORT_MENU];

/**
 * What a part puts on the body itself, whichever margin is open: highlights, markers, a
 * bubble over a selection, a shortcut. Mounted once beside the editor, inside the column.
 */
export const LAYER_SLOTS: readonly ComponentType<PageSlotProps>[] = [COMMENT_LAYER];
