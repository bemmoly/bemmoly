import type { ShortcutGroup } from '@bemmoly/core-web';

/** The frame's own keys; screens add theirs (Inbox's E and S, the board's) while they show. */
export function shellShortcuts(options: {
  createLabel: string | null;
  /** The chords modules bind to their places, from the manifests. */
  chords: readonly { keys: string; label: string }[];
}): ShortcutGroup[] {
  return [
    {
      id: 'global',
      label: 'Everywhere',
      keys: [
        { keys: 'Mod+K', label: 'Search and run a command' },
        { keys: '/', label: 'Search' },
        ...(options.createLabel ? [{ keys: 'C', label: `New ${options.createLabel}` }] : []),
        { keys: '[', label: 'Fold or unfold the sidebar' },
        { keys: '?', label: 'Show these shortcuts' },
      ],
    },
    {
      id: 'go',
      label: 'Go to',
      keys: [{ keys: 'G H', label: 'Home' }, { keys: 'G I', label: 'Inbox' }, ...options.chords],
    },
    {
      id: 'lists',
      label: 'Lists and dialogs',
      keys: [
        { keys: 'J K', label: 'Move down and up (or the arrow keys)' },
        { keys: 'Enter', label: 'Open' },
        { keys: 'Esc', label: 'Close, or clear the selection' },
        { keys: 'Tab', label: 'In the palette, filter by type' },
      ],
    },
  ];
}
