import type { BackupKind } from '@bemmoly/shared';
import type { SystemDependencies } from './deps.ts';

/**
 * Events the system service publishes. Email and in-app notifications subscribe
 * (Stream C); the payloads are the contract.
 */
export const SYSTEM_EVENTS = {
  backupFailed: 'backup.failed',
  backupVerificationFailed: 'backup.verification_failed',
  updateAvailable: 'update.available',
} as const;

export interface BackupFailedPayload {
  backupId: string | null;
  kind: BackupKind;
  /** disk_space: the guard refused to start; error: the run failed. */
  reason: 'disk_space' | 'error';
  message: string;
}

export interface BackupVerificationFailedPayload {
  backupId: string;
  setName: string;
  depth: 'list' | 'restore';
  message: string;
}

export interface UpdateAvailablePayload {
  currentVersion: string;
  version: string;
  channel: 'stable' | 'beta';
  publishedAt: string;
  notesUrl: string | null;
  /** The release contains a changeset that makes rollback a restore. */
  hasIrreversibleChangesets: boolean;
}

type Payloads = {
  'backup.failed': BackupFailedPayload;
  'backup.verification_failed': BackupVerificationFailedPayload;
  'update.available': UpdateAvailablePayload;
};

/** Publishes without failing the caller: an alert that cannot be sent is logged. */
export async function publishSystemEvent<Kind extends keyof Payloads>(
  deps: Pick<SystemDependencies, 'events' | 'logger' | 'now'>,
  kind: Kind,
  payload: Payloads[Kind],
  entityId?: string,
): Promise<void> {
  deps.logger.warn({ event: kind, payload }, `system event ${kind}`);
  if (!deps.events) return;
  try {
    await deps.events.publish({
      kind,
      occurredAt: deps.now?.() ?? new Date(),
      actor: { kind: 'system', id: 'system' },
      ...(entityId
        ? { entity: { kind: kind.startsWith('backup') ? 'backup' : 'release', id: entityId } }
        : {}),
      payload,
    });
  } catch (error) {
    deps.logger.error({ err: error, event: kind }, 'could not publish a system event');
  }
}
