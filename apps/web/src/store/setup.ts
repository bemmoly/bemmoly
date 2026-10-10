import type { SurfaceTone, ThemeFont, ThemeMode } from '@bemmoly/shared';
import { DEFAULT_PRESET, type PresetId } from '@bemmoly/ui/tokens';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_BRAND } from '../components/appearance/brand-choices.ts';

/** The import card picked on the Import step; null until one is picked. */
export type ImportSourceId = 'jira' | 'confluence' | 'csv' | 'clean';

/** A catalog provider id, the local server, or no AI at all. */
export type AiChoice = string;
export const LOCAL_AI = 'local';
export const NO_AI = 'none';

/** The Look step's custom build: the Appearance page's custom theme inputs. */
export interface CustomThemeDraft {
  brand: string;
  mode: ThemeMode;
  surfaces: SurfaceTone;
  font: ThemeFont;
}

export const INITIAL_CUSTOM_THEME: CustomThemeDraft = {
  brand: DEFAULT_BRAND,
  mode: 'light',
  surfaces: 'neutral',
  font: 'plex',
};

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
  theme: PresetId;
  /** Step 5 builds a custom theme instead of the preset; the build survives picking a tile. */
  useCustomTheme: boolean;
  customTheme: CustomThemeDraft;
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
  theme: DEFAULT_PRESET,
  useCustomTheme: false,
  customTheme: INITIAL_CUSTOM_THEME,
  lastStep: null,
  skipped: [],
  aiSaved: false,
  themeSaved: false,
};

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
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): SetupDraft => draftOf(state),
    },
  ),
);
