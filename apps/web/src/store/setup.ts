import { DEFAULT_PRESET, type PresetId } from '@bemmoly/ui/tokens';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** The import card picked on step 2; null until one is picked. */
export type ImportSourceId = 'jira' | 'confluence' | 'csv' | 'clean';

/** A catalog provider id, the local server, or no AI at all. */
export type AiChoice = string;
export const LOCAL_AI = 'local';
export const NO_AI = 'none';

export interface SetupDraft {
  importSource: ImportSourceId | null;
  /** Addresses shown as chips on step 3, not yet invited. */
  emails: string[];
  roleId: string | null;
  teamId: string | null;
  invitesSent: number;
  ai: AiChoice;
  shareContent: boolean;
  allowActions: boolean;
  theme: PresetId;
  /** Whether steps 4 and 5 were saved or skipped, so the summary says what happened. */
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
  importSource: null,
  emails: [],
  roleId: null,
  teamId: null,
  invitesSent: 0,
  ai: NO_AI,
  shareContent: true,
  allowActions: true,
  theme: DEFAULT_PRESET,
  aiSaved: false,
  themeSaved: false,
};

/**
 * Choices made in the wizard before they are saved. Session storage, so a
 * reload keeps them but a new tab or a later sign-in starts fresh.
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
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state): SetupDraft => ({
        importSource: state.importSource,
        emails: state.emails,
        roleId: state.roleId,
        teamId: state.teamId,
        invitesSent: state.invitesSent,
        ai: state.ai,
        shareContent: state.shareContent,
        allowActions: state.allowActions,
        theme: state.theme,
        aiSaved: state.aiSaved,
        themeSaved: state.themeSaved,
      }),
    },
  ),
);
