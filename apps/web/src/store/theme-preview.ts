import { create } from 'zustand';
import type { LookPreview } from '../lib/theme.ts';

interface ThemePreviewState {
  /** The look being tried on, above every other source while set. */
  preview: LookPreview | null;
  setPreview(preview: LookPreview | null): void;
}

/**
 * A theme shown on the whole page before it is saved. Memory only, never
 * persisted, so a reload or a new tab always starts from the saved look.
 */
export const useThemePreviewStore = create<ThemePreviewState>()((set) => ({
  preview: null,
  setPreview: (preview) => set({ preview }),
}));
