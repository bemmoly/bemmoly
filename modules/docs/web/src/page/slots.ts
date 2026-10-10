import type { IconName } from '@bemmoly/ui/icons';
import type { ComponentType } from 'react';
import type { PageDetail } from '../../../shared/pages.ts';

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
}

/**
 * A tab of the side panel beside the body (the mock's Copilot, Comments and Linked work).
 * "About" is the screen's own first tab; each entry here adds one after it.
 */
export interface PanelSlot {
  /** Stable id, also the panel value in openPanel("comments"). */
  id: string;
  /** The tab's name: "Comments". */
  label: string;
  /** A number after the name, as the mock's "Comments (3)". */
  useCount?: (page: PageDetail) => number | undefined;
  /** A toggle in the header beside Share, opening the panel on this tab. */
  header?: { icon: IconName; label: string };
  /** An entry in the More menu opening the panel on this tab ("History"). */
  menu?: { icon?: IconName; label: string };
  /** False keeps it out of the tab strip: it opens from the header or the menu only. */
  tab?: boolean;
  Component: ComponentType<PageSlotProps & { onClose: () => void }>;
}

/** Tabs after "About", in order. */
export const PANEL_SLOTS: readonly PanelSlot[] = [];

/**
 * Rows of the More menu between the built-in actions and Move to trash: export, for one.
 * Each renders MenuItem elements; it may use hooks and returns null to hide itself.
 */
export const MENU_SLOTS: readonly ComponentType<PageSlotProps>[] = [];

/**
 * Sections of the About tab after the page's own facts: "Referenced in", backlinks and
 * linked issues. Each draws its own heading and returns null while it has nothing to show.
 */
export const ABOUT_SLOTS: readonly ComponentType<PageSlotProps>[] = [];
