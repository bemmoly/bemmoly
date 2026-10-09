import { create } from 'zustand';

/** The kernel's scopes, or a module search kind such as "work.issue". */
export type PaletteScope = 'all' | 'people' | 'settings' | 'actions' | (string & {});

/** Client-only shell state: which overlay is open. Server data never lives here. */
interface UiState {
  paletteOpen: boolean;
  /** The scope ⌘K opens on; "Create" opens it on Actions. */
  paletteScope: PaletteScope;
  inboxOpen: boolean;
  /** Prefills the Users search when ⌘K opens a person. */
  userSearch: string;
  /** "Invite people" from ⌘K opens the dialog on the Users page. */
  inviteRequested: boolean;
  requestInvite(requested: boolean): void;
  openPalette(scope?: PaletteScope): void;
  closePalette(): void;
  togglePalette(): void;
  setInboxOpen(open: boolean): void;
  setUserSearch(value: string): void;
}

export const useUiStore = create<UiState>()((set) => ({
  paletteOpen: false,
  paletteScope: 'all',
  inboxOpen: false,
  userSearch: '',
  inviteRequested: false,
  requestInvite: (requested) => set({ inviteRequested: requested }),
  openPalette: (scope = 'all') => set({ paletteOpen: true, paletteScope: scope, inboxOpen: false }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () =>
    set((state) => ({ paletteOpen: !state.paletteOpen, paletteScope: 'all', inboxOpen: false })),
  setInboxOpen: (open) => set({ inboxOpen: open, paletteOpen: false }),
  setUserSearch: (value) => set({ userSearch: value }),
}));
