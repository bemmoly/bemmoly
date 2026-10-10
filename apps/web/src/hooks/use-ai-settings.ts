import { NO_AI, type AiChoice } from '../store/setup.ts';

/** The workspace settings key that remembers the wizard's provider pick (providerChoice). */
export const AI_KEYS = ['ai.providerId', 'ai.shareContent', 'ai.allowActions'] as const;

/** What AI may see and do: the words both the wizard and Settings › Privacy use. */
export const PRIVACY_ROWS = {
  shareContent: {
    label: 'Send issue and doc content to the provider',
    hint: 'Required for summaries and Q&A. Off means AI only sees titles, keys, statuses and fields.',
  },
  redactEmails: {
    label: 'Hide email addresses',
    hint: 'Replaced with placeholders before anything is sent, and put back in what comes back.',
  },
  redactNames: {
    label: 'Hide people’s names',
    hint: 'Replaced with placeholders before anything is sent, and put back in what comes back.',
  },
  allowActions: {
    label: 'Let AI actions change data',
    hint: 'Always previewed and confirmed by a person. Logged in the audit trail. Off makes the palette answer and draft only.',
  },
  optOut: {
    label: 'Let people turn AI off for themselves',
    hint: 'From their profile. Their own writing then stays out of summaries others ask for, except titles.',
  },
} as const;

export const NO_AI_OPTION = {
  id: NO_AI,
  name: 'No AI for now',
  description: 'Everything else works. You can connect a provider any time.',
} as const;

export const LOCAL_DESCRIPTION =
  'Runs on your hardware. Nothing leaves the network. Needs a GPU for good speed.';

/** The picker's choice as the stored ai.providerId. */
export function providerIdOf(choice: AiChoice | null): string | null {
  return !choice || choice === NO_AI ? null : choice;
}

/** A stored ai.providerId as the picker's choice. */
export function choiceOf(providerId: string | null | undefined): AiChoice {
  return providerId ?? NO_AI;
}

/** The setting values the wizard writes beside the AI runtime's own settings. */
export function aiSettingValues(form: {
  ai: AiChoice;
  shareContent: boolean;
  allowActions: boolean;
}) {
  return {
    'ai.providerId': providerIdOf(form.ai),
    'ai.shareContent': form.shareContent,
    'ai.allowActions': form.allowActions,
  };
}

/** The Done step's AI line: provider, then the two privacy choices in words. */
export function aiSummary(
  providerName: string | null,
  form: { shareContent: boolean; allowActions: boolean },
): string {
  if (!providerName) return NO_AI_OPTION.name;
  const content = form.shareContent ? 'content sharing on' : 'titles and metadata only';
  const actions = form.allowActions ? 'actions require confirmation' : 'AI actions off';
  return [providerName, content, actions].join(' · ');
}
