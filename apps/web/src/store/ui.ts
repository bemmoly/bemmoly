import { create } from 'zustand';

/** The kernel's scopes, or a module search kind such as "work.issue". */
export type PaletteScope = 'all' | 'people' | 'settings' | 'actions' | (string & {});

/** Client-only shell state: which overlay is open. Server data never lives here. */
interface UiState {
  paletteOpen: boolean;
  /** The scope ⌘K opens on. */
  paletteScope: PaletteScope;
  /** The "?" overlay listing every shortcut. */
  shortcutsOpen: boolean;
  /** About Bemmoly, from the workspace menu. */
  aboutOpen: boolean;
  /** Prefills the Users search when ⌘K opens a person. */
  userSearch: string;
  /** "Invite people" from ⌘K or the workspace menu opens the dialog on the Users page. */
  inviteRequested: boolean;
  /** The last page outside Settings, where "Back to app" returns. */
  appPath: string;
  requestInvite(requested: boolean): void;
  openPalette(scope?: PaletteScope): void;
  closePalette(): void;
  togglePalette(): void;
  setShortcutsOpen(open: boolean): void;
  setAboutOpen(open: boolean): void;
  setUserSearch(value: string): void;
  setAppPath(path: string): void;
}

export const useUiStore = create<UiState>()((set) => ({
  paletteOpen: false,
  paletteScope: 'all',
  shortcutsOpen: false,
  aboutOpen: false,
  userSearch: '',
  inviteRequested: false,
  appPath: '/',
  requestInvite: (requested) => set({ inviteRequested: requested }),
  openPalette: (scope = 'all') =>
    set({ paletteOpen: true, paletteScope: scope, shortcutsOpen: false }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () =>
    set((state) => ({
      paletteOpen: !state.paletteOpen,
      paletteScope: 'all',
      shortcutsOpen: false,
    })),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open, paletteOpen: false }),
  setAboutOpen: (open) => set({ aboutOpen: open }),
  setUserSearch: (value) => set({ userSearch: value }),
  setAppPath: (path) => set({ appPath: path }),
}));
