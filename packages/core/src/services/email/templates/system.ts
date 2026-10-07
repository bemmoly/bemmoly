import { createElement as h, Fragment } from 'react';
import type { EmailContent, EmailFrame } from './layout.ts';
import { ActionButton, formatDateTime, Muted, Paragraph, Quote, Title } from './parts.ts';

export interface BackupFailedEmailData {
  /** The failure in plain words, as recorded on the backup. */
  error: string;
  backupKind: string;
  startedAt: Date;
  backupsUrl: string;
}

export function backupFailedEmail(frame: EmailFrame, data: BackupFailedEmailData): EmailContent {
  const { theme, brand } = frame;
  return {
    subject: `A backup of ${brand.workspaceName} failed`,
    preview: data.error,
    body: h(
      Fragment,
      null,
      h(Title, { theme }, 'A backup failed'),
      h(
        Paragraph,
        { theme },
        `The ${data.backupKind} backup that started ${formatDateTime(data.startedAt)} did not finish.`,
      ),
      h(Quote, { theme }, data.error),
      h(
        Muted,
        { theme },
        'Until a backup succeeds, the last verified one is the newest restore point.',
      ),
      h(ActionButton, { theme, href: data.backupsUrl }, 'Open backups'),
    ),
  };
}

export interface UpdateAvailableEmailData {
  version: string;
  currentVersion: string | null;
  notesUrl: string | null;
  updatesUrl: string;
}

export function updateAvailableEmail(
  frame: EmailFrame,
  data: UpdateAvailableEmailData,
): EmailContent {
  const { theme, brand } = frame;
  const from = data.currentVersion ? ` (you run ${data.currentVersion})` : '';
  return {
    subject: `Bemmoly ${data.version} is available`,
    preview: `An update for ${brand.workspaceName} is ready`,
    body: h(
      Fragment,
      null,
      h(Title, { theme }, `Bemmoly ${data.version} is available`),
      h(
        Paragraph,
        { theme },
        `An update is ready for ${brand.workspaceName}${from}. A backup is taken before it is applied, and a failed health check rolls it back.`,
      ),
      data.notesUrl ? h(Muted, { theme }, `Release notes: ${data.notesUrl}`) : null,
      h(ActionButton, { theme, href: data.updatesUrl }, 'Review the update'),
    ),
  };
}
