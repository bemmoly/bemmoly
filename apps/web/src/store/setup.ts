import type { ModePreference } from '@bemmoly/shared';
import { DEFAULT_THEME, RETIRED_PRESETS, isThemeId, type ThemeId } from '@bemmoly/ui/tokens';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** The import card picked on the Import step; null until one is picked. */
export type ImportSourceId = 'jira' | 'confluence' | 'csv' | 'clean';

/** A catalog provider id, the local server, or no AI at all. */
export type AiChoice = string;
export const LOCAL_AI = 'local';
export const NO_AI = 'none';

/** Where the Look step's brand colour starts: a teal clear of every reserved hue. */
export const SETUP_BRAND = '#0f766e';

export interface SetupDraft {
  /**
   * The first step's answers, held until the account step creates the admin with them. The
   * password is never kept here.
   */
  workspaceName: string;
  /** Null until edited: the field starts at the address the browser used. */
  workspaceUrl: string | null;
  importSource: ImportSourceId | null;
  /** Addresses shown as chips on the People step, not yet invited. */
  emails: string[];
  roleId: string | null;
  teamId: string | null;
  invitesSent: number;
  ai: AiChoice;
  shareContent: boolean;
  allowActions: boolean;
  theme: ThemeId;
  /** The workspace default mode; new workspaces follow each device (ADR 0021). */
  defaultMode: ModePreference;
  /** The Look step makes a custom theme from the brand colour instead of a built-in one. */
  useCustomTheme: boolean;
  brand: string;
  /** The last of steps 2 to 5 the admin was on, so an interrupted wizard resumes there. */
  lastStep: number | null;
  /** Steps left with "Skip for now", drawn as empty circles until they are answered. */
  skipped: number[];
  /** Whether the AI and Look steps were saved or skipped, so the summary says what happened. */
  aiSaved: boolean;
  themeSaved: boolean;
}

interface SetupState extends SetupDraft {
  update(patch: Partial<SetupDraft>): void;
  addEmails(emails: readonly string[]): void;
  removeEmail(email: string): void;
  reset(): void;
}

export const INITIAL_SETUP_DRAFT: SetupDraft = {
  workspaceName: '',
  workspaceUrl: null,
  importSource: null,
  emails: [],
  roleId: null,
  teamId: null,
  invitesSent: 0,
  ai: NO_AI,
  shareContent: true,
  allowActions: true,
  theme: DEFAULT_THEME,
  defaultMode: 'system',
  useCustomTheme: false,
  brand: SETUP_BRAND,
  lastStep: null,
  skipped: [],
  aiSaved: false,
  themeSaved: false,
};

/** A stored draft from before themes: its preset as a theme, the rest as it was. */
export function migrateSetupDraft(stored: unknown): SetupDraft {
  const old = (stored ?? {}) as Partial<SetupDraft> & {
    theme?: string;
    customTheme?: { brand?: string };
  };
  const theme = isThemeId(old.theme)
    ? old.theme
    : (RETIRED_PRESETS[old.theme ?? '']?.theme ?? DEFAULT_THEME);
  const { customTheme, ...rest } = old;
  return {
    ...INITIAL_SETUP_DRAFT,
    ...rest,
    theme,
    brand: customTheme?.brand ?? old.brand ?? SETUP_BRAND,
  };
}

/** The draft as stored: everything but the actions. */
export function draftOf(state: SetupDraft): SetupDraft {
  return Object.fromEntries(
    (Object.keys(INITIAL_SETUP_DRAFT) as (keyof SetupDraft)[]).map((key) => [key, state[key]]),
  ) as unknown as SetupDraft;
}

/**
 * Choices made in the wizard before they are saved. Local storage, so closing the tab and
 * coming back later resumes at the step that was left; reaching the summary clears it.
 */
export const useSetupStore = create<SetupState>()(
  persist(
    (set) => ({
      ...INITIAL_SETUP_DRAFT,
      update: (patch) => set(patch),
      addEmails: (emails) =>
        set((state) => ({ emails: [...new Set([...state.emails, ...emails])] })),
      removeEmail: (email) =>
        set((state) => ({ emails: state.emails.filter((entry) => entry !== email) })),
      reset: () => set(INITIAL_SETUP_DRAFT),
    }),
    {
      name: 'bemmoly.setup',
      // 2: the workspace and the account became two steps, so stored step numbers moved.
      // 3: presets became themes with a separate mode; the custom build became a brand colour.
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): SetupDraft => draftOf(state),
      migrate: (stored) => migrateSetupDraft(stored),
    },
  ),
);
