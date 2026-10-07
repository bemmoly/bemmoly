import { DIGEST_SCOPE } from '../email/index.ts';

/** Inbox and email phrasing per kind, read as "<actor> <verb> <target>", as in the Home mock. */
const VERBS: Readonly<Record<string, string>> = {
  mention: 'mentioned you in',
  assignment: 'assigned you',
  review_request: 'requested your review on',
  comment: 'commented on',
  status_change: 'moved',
  watch_update: 'updated',
  backup_failed: 'reported a failed backup:',
  update_available: 'found an update:',
};

const LABELS: Readonly<Record<string, string>> = {
  mention: 'Mentions',
  assignment: 'Assignments',
  review_request: 'Review requests',
  comment: 'Comments on things you watch',
  status_change: 'Status changes',
  watch_update: 'Updates to things you watch',
  backup_failed: 'Failed backups',
  update_available: 'Available updates',
  [DIGEST_SCOPE]: 'The notification digest',
};

/** Shown when no person caused the notification (system kinds). */
export const SYSTEM_ACTOR = 'Bemmoly';

export function verbFor(kind: string): string {
  return VERBS[kind] ?? 'updated';
}

export function labelFor(scope: string): string {
  return LABELS[scope] ?? scope.replaceAll('_', ' ').replaceAll('.', ' · ');
}

/** The email's one-line reason, unless the publisher supplied its own. */
export function reasonFor(kind: string, targetLabel: string, override?: string | null): string {
  const because = (text: string) => `You're receiving this because ${text}.`;
  if (override) return because(override.replace(/\.$/, ''));
  switch (kind) {
    case 'mention':
      return because(`you were mentioned in ${targetLabel}`);
    case 'assignment':
      return because(`${targetLabel} is assigned to you`);
    case 'review_request':
      return because(`your review was requested on ${targetLabel}`);
    case 'comment':
    case 'status_change':
    case 'watch_update':
      return because(`you watch ${targetLabel}`);
    case 'backup_failed':
    case 'update_available':
      return because('you administer this workspace');
    default:
      return because(`your notification settings send "${labelFor(kind)}" by email`);
  }
}

/** "Aisha K.", "Aisha K. and Jonas M.", "Aisha K. and 2 others". */
export function actorPhrase(names: readonly string[]): string {
  const [first, second] = names;
  if (!first) return SYSTEM_ACTOR;
  if (!second) return first;
  if (names.length === 2) return `${first} and ${second}`;
  return `${first} and ${names.length - 1} others`;
}
