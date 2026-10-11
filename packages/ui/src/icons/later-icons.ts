import { EDITOR_ICONS } from './editor-icons.tsx';
import { KIT_MORE } from './kit-more.tsx';

/** The drawings that load after the shell, as one chunk: see `loadLaterIcons` in icon.tsx. */
export const LATER_ICONS = { ...KIT_MORE, ...EDITOR_ICONS };
