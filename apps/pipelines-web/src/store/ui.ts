import { create } from 'zustand';

/** Client state the shell owns: the command palette and the phone's place sheet. */
interface UiState {
  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  /** "?": every key that works on the screen on show. */
  keysOpen: boolean;
  setKeysOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  paletteOpen: false,
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  keysOpen: false,
  setKeysOpen: (open) => set({ keysOpen: open }),
}));
