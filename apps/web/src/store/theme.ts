import { PRESET_IDS, type PresetId } from '@bemmoly/ui/tokens';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PersonalMode, PersonalTheme } from '../lib/theme.ts';

interface ThemeState extends PersonalTheme {
  setMode(mode: PersonalMode): void;
  setPreset(preset: PresetId | null): void;
}

export function isPresetId(value: unknown): value is PresetId {
  return (PRESET_IDS as readonly unknown[]).includes(value);
}

/** This device's own choice; the workspace policy decides how much of it applies. */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      preset: null,
      setMode: (mode) => set({ mode }),
      setPreset: (preset) => set({ preset }),
    }),
    {
      name: 'bemmoly.theme',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ mode: state.mode, preset: state.preset }),
      migrate: () => ({ mode: 'system', preset: null }),
    },
  ),
);
