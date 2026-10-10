import { useShortcutHelp, type ShortcutGroup } from '@bemmoly/core-web';

/*
 * What each Docs screen lists in the "?" overlay while it shows, as Work's screens do. The
 * keys are the ones the screens bind; keep the two in step.
 */

const HOME: ShortcutGroup = {
  id: 'docs.home',
  label: 'Docs home',
  keys: [
    { keys: 'N', label: 'New page, in the space you last wrote in' },
    { keys: '1 2 3 4', label: 'Recent, Starred, My drafts, For review' },
    { keys: 'J K', label: 'Move through the list' },
    { keys: 'Enter', label: 'Open the page' },
  ],
};

const SPACE: ShortcutGroup = {
  id: 'docs.space',
  label: 'Space',
  keys: [
    { keys: 'N', label: 'New page at the top of the space' },
    { keys: 'F', label: 'Focus the sidebar on this space (on its row)' },
    { keys: 'F2', label: 'Rename the page row in focus' },
  ],
};

const TRASH: ShortcutGroup = {
  id: 'docs.trash',
  label: 'Trash',
  keys: [
    { keys: '/', label: 'Search the trash' },
    { keys: 'J K', label: 'Move through the pages' },
    { keys: 'Enter', label: 'Preview the page' },
    { keys: 'R', label: 'Restore it' },
    { keys: 'Mod+Backspace', label: 'Delete it forever (asks first)' },
  ],
};

const PAGE: ShortcutGroup = {
  id: 'docs.page',
  label: 'Page',
  keys: [
    { keys: 'N', label: 'New page beside this one' },
    { keys: 'Shift+N', label: 'New page inside this one' },
    { keys: '/', label: 'Insert a block, while writing' },
    { keys: 'Mod+K', label: 'Link the selected words' },
    { keys: 'Mod+Alt+M', label: 'Comment on the selection' },
    { keys: 'Mod+Alt+O', label: 'Outline' },
    { keys: 'Mod+Alt+C', label: 'Comments' },
    { keys: 'Mod+Alt+L', label: 'Linked work' },
    { keys: 'Mod+Alt+H', label: 'Version history' },
  ],
};

export const DOCS_SHORTCUTS = { home: HOME, space: SPACE, trash: TRASH, page: PAGE } as const;

/** Lists the screen's keys in the "?" overlay while it is mounted. */
export function useDocsShortcutHelp(screen: keyof typeof DOCS_SHORTCUTS): void {
  useShortcutHelp(DOCS_SHORTCUTS[screen]);
}
