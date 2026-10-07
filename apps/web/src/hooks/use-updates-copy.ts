import { isApiError } from '@bemmoly/api-client';
import { formatDateTime } from '@bemmoly/core-web';
import type { AvailableUpdate, RollbackPlan, UpdatesOverview } from '@bemmoly/shared';

const MODES: Record<RollbackPlan['mode'], string> = {
  code: 'Code rollback',
  schema: 'Schema rollback',
  restore: 'Restore rollback',
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export interface RollbackCopy {
  mode: string;
  /** The server's one sentence naming what is lost. */
  summary: string;
  details: string[];
  /** Restore rollbacks lose writes since the backup; the dialog offers their audit rows first. */
  exportSince: string | null;
}

/** What a rollback does and loses, named before the admin confirms, per the plan's mode. */
export function rollbackCopy(plan: RollbackPlan): RollbackCopy {
  const base = { mode: MODES[plan.mode], summary: plan.summary, exportSince: null };
  if (plan.mode === 'schema') {
    const changes = plan.schemaChangesets.map((change) => `${change.module}/${change.id}`);
    return {
      ...base,
      details: [
        `Reverses ${plural(changes.length, 'schema change')}${changes.length ? `: ${changes.join(', ')}` : ''}.`,
        'Fields added since the update are dropped with their data; everything else stays.',
      ],
    };
  }
  if (plan.mode === 'restore') {
    const discard = plan.discard;
    return {
      ...base,
      details: [
        discard
          ? `Restoring ${plan.toVersion} will discard ${plural(discard.changes, 'change')} made since ${formatDateTime(discard.since)} by ${discard.people === 1 ? '1 person' : `${discard.people} people`}.`
          : `Restoring ${plan.toVersion} discards everything written since the pre-update backup.`,
        'The current database is kept for the retention window.',
      ],
      exportSince: discard?.since ?? null,
    };
  }
  return {
    ...base,
    details: ['Nothing is lost: everything people did since the update stays.'],
  };
}

/** How "Update to X" runs on this install. */
export function updateModeCopy(mode: UpdatesOverview['updater']['mode']): string {
  return mode === 'in_app'
    ? 'Bemmoly backs up first, then swaps to the new version and runs its changesets. Downtime is usually under a minute; this page shows the progress.'
    : 'This install has no in-app updater. Run this on the server:';
}

export interface ReleaseWarning {
  title: string;
  items: string[];
}

/** What the admin should know before confirming: slow or irreversible changes, new config. */
export function releaseWarnings(release: AvailableUpdate): ReleaseWarning[] {
  const warnings: ReleaseWarning[] = [];
  const describe = (change: AvailableUpdate['slowChangesets'][number]) =>
    `${change.module}/${change.id}: ${change.description}`;
  if (release.irreversibleChangesets.length) {
    warnings.push({
      title:
        'These changes cannot be reversed in place. Rolling back would restore the pre-update backup and discard what was written since.',
      items: release.irreversibleChangesets.map(describe),
    });
  }
  if (release.slowChangesets.length) {
    warnings.push({
      title: 'These take longer on large tables, so expect more downtime than usual.',
      items: release.slowChangesets.map(describe),
    });
  }
  const { added, removed } = release.configChanges;
  if (added.length || removed.length) {
    warnings.push({
      title: 'Configuration changes in .env:',
      items: [...added.map((key) => `New: ${key}`), ...removed.map((key) => `Removed: ${key}`)],
    });
  }
  return warnings;
}

/** The `sudo bemmoly upgrade X` command a 409 carries when the install has no updater. */
export function commandFrom(error: unknown): string | null {
  if (!isApiError(error) || error.status !== 409) return null;
  const details = error.details as { command?: unknown } | undefined;
  return typeof details?.command === 'string' ? details.command : null;
}
