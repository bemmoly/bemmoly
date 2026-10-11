import type { ModePreference } from '@bemmoly/shared';
import { RETIRED_PRESETS } from '@bemmoly/ui/tokens';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PersonalAppearance } from '../lib/theme.ts';

interface ThemeState extends PersonalAppearance {
  setMode(mode: ModePreference | null): void;
  /** Replaces the cache with what the account says (/me). */
  hydrate(value: PersonalAppearance): void;
}

const MODES: readonly unknown[] = ['light', 'dark', 'system'];

/**
 * The cache of version 2, when the device itself held the choice: "system" meant the
 * workspace default and a preset carried its own mode. Mapped once to the account's shape,
 * then written to the account on the next sign-in (useAppearanceSync).
 */
export function migrateDeviceTheme(stored: unknown): PersonalAppearance {
  const old = (stored ?? {}) as { mode?: unknown; preset?: unknown };
  const retired = typeof old.preset === 'string' ? RETIRED_PRESETS[old.preset] : undefined;
  const mode = old.mode === 'light' || old.mode === 'dark' ? old.mode : null;
  return { mode: retired?.mode ?? mode, theme: retired?.theme ?? null };
}

/**
 * The person's appearance as this device last knew it: a first-paint cache that /me
 * replaces, never the source of truth (ADR 0021). Before sign-in it is all there is.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: null,
      theme: null,
      setMode: (mode) => set({ mode }),
      hydrate: ({ mode, theme }) => set({ mode, theme }),
    }),
    {
      name: 'bemmoly.theme',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ mode: state.mode, theme: state.theme }),
      migrate: (stored, version) =>
        version < 3
          ? migrateDeviceTheme(stored)
          : {
              mode: MODES.includes((stored as PersonalAppearance)?.mode)
                ? (stored as PersonalAppearance).mode
                : null,
              theme: (stored as PersonalAppearance)?.theme ?? null,
            },
    },
  ),
);
