import { z } from 'zod';
import {
  backupFailedEmail,
  notificationEmail,
  updateAvailableEmail,
  type EmailFrame,
} from '../email/index.ts';
import { SYSTEM_ACTOR, verbFor } from './copy.ts';
import type { StoredNotification } from './grouping.ts';

const backupFailedData = z.object({
  error: z.string().min(1),
  backupKind: z.string().default('scheduled'),
  startedAt: z.coerce.date(),
});

const updateAvailableData = z.object({
  version: z.string().min(1),
  currentVersion: z.string().nullable().default(null),
  notesUrl: z.url().nullable().default(null),
});

/**
 * The email for one notification: the kind's own template when it has one and
 * its data parses, otherwise the generic "<actor> <verb> <target>" email.
 */
export function immediateEmailContent(
  frame: EmailFrame,
  row: StoredNotification,
  data: Record<string, unknown>,
  absoluteUrl: (path: string) => string,
) {
  if (row.kind === 'backup_failed') {
    const parsed = backupFailedData.safeParse(data);
    if (parsed.success) {
      return backupFailedEmail(frame, {
        ...parsed.data,
        backupsUrl: absoluteUrl('/settings/backups'),
      });
    }
  }
  if (row.kind === 'update_available') {
    const parsed = updateAvailableData.safeParse(data);
    if (parsed.success) {
      return updateAvailableEmail(frame, {
        ...parsed.data,
        updatesUrl: absoluteUrl('/settings/updates'),
      });
    }
  }
  return notificationEmail(frame, {
    lead: `${row.actorName ?? SYSTEM_ACTOR} ${verbFor(row.kind)}`,
    targetLabel: row.targetLabel ?? row.targetId,
    targetUrl: row.targetUrl,
    body: row.body,
    createdAt: row.createdAt,
    hasActor: row.actorName !== null,
  });
}
