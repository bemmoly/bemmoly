import { DEFAULT_PRESET, PRESET_IDS, type PresetId } from '@bemmoly/ui/tokens';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeChoice = PresetId | 'system';

interface ThemeState {
  choice: ThemeChoice;
  setChoice(choice: ThemeChoice): void;
}

/** `system` follows the OS: Classic when light, Dark when dark. */
export function resolveThemeChoice(choice: ThemeChoice, prefersDark: boolean): PresetId {
  if (choice !== 'system') return choice;
  return prefersDark ? 'dark' : DEFAULT_PRESET;
}

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'system' || (PRESET_IDS as readonly unknown[]).includes(value);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      choice: 'system',
      setChoice: (choice) => set({ choice }),
    }),
    {
      name: 'bemmoly.theme',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ choice: state.choice }),
    },
  ),
);
