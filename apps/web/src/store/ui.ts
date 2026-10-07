import { create } from 'zustand';

/** Client-only shell state: which overlay is open. Server data never lives here. */
interface UiState {
  paletteOpen: boolean;
  inboxOpen: boolean;
  /** Prefills the Users search when ⌘K opens a person. */
  userSearch: string;
  /** "Invite people" from Create or ⌘K opens the dialog on the Users page. */
  inviteRequested: boolean;
  requestInvite(requested: boolean): void;
  openPalette(): void;
  closePalette(): void;
  togglePalette(): void;
  setInboxOpen(open: boolean): void;
  setUserSearch(value: string): void;
}

export const useUiStore = create<UiState>()((set) => ({
  paletteOpen: false,
  inboxOpen: false,
  userSearch: '',
  inviteRequested: false,
  requestInvite: (requested) => set({ inviteRequested: requested }),
  openPalette: () => set({ paletteOpen: true, inboxOpen: false }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set((state) => ({ paletteOpen: !state.paletteOpen, inboxOpen: false })),
  setInboxOpen: (open) => set({ inboxOpen: open, paletteOpen: false }),
  setUserSearch: (value) => set({ userSearch: value }),
}));
