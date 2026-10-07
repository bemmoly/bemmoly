import type { RollbackMode } from '@bemmoly/shared';
import semver from 'semver';
import type { ChangesetTraits } from '../deps.ts';

export interface RollbackModeInput {
  fromVersion: string;
  toVersion: string;
  /** Changesets applied after the pre-upgrade tag; null when the tag is unknown. */
  changesetsSinceTag: readonly ChangesetTraits[] | null;
  preferRestore: boolean;
  /** A pre-upgrade backup inside its retention window. */
  hasPreUpgradeBackup: boolean;
}

export interface RollbackModeDecision {
  mode: RollbackMode;
  reason: string;
  /** For schema mode: the changesets whose `down` runs, newest first. */
  schemaChangesets: { module: string; id: string }[];
}

/**
 * Every release must run against the previous minor's schema (§7.1), so going back
 * one minor or less within a major needs no database change.
 */
export function withinCompatibilityWindow(fromVersion: string, toVersion: string): boolean {
  const from = semver.parse(fromVersion);
  const to = semver.parse(toVersion);
  if (!from || !to) return false;
  if (from.major !== to.major) return false;
  return from.minor - to.minor <= 1;
}

const label = (changeset: ChangesetTraits) => `${changeset.module}/${changeset.id}`;

/** Code, schema or restore, as "Rolling back after an update" prescribes. */
export function decideRollbackMode(input: RollbackModeInput): RollbackModeDecision {
  const none = { schemaChangesets: [] };
  const restoreOr = (reason: string): RollbackModeDecision =>
    input.hasPreUpgradeBackup
      ? { mode: 'restore', reason, ...none }
      : {
          mode: 'restore',
          reason: `${reason} No pre-upgrade backup is left, so the newest backup will be used.`,
          ...none,
        };

  if (input.preferRestore) return restoreOr('A restore was requested.');

  const changesets = input.changesetsSinceTag;
  if (changesets === null) {
    return input.hasPreUpgradeBackup
      ? restoreOr('The changelog has no pre-upgrade tag, so the schema changes are unknown.')
      : {
          mode: 'code',
          reason: 'No pre-upgrade tag or backup exists; only the image is swapped back.',
          ...none,
        };
  }
  if (changesets.length === 0) {
    return { mode: 'code', reason: `${input.fromVersion} ran no changesets.`, ...none };
  }

  const irreversible = changesets.find((changeset) => changeset.irreversible);
  if (irreversible) {
    return restoreOr(`${label(irreversible)} is irreversible.`);
  }

  if (withinCompatibilityWindow(input.fromVersion, input.toVersion)) {
    return {
      mode: 'code',
      reason: `${input.toVersion} runs against the schema ${input.fromVersion} left (same compatibility window).`,
      ...none,
    };
  }

  const withoutDown = changesets.find((changeset) => !changeset.hasDown);
  if (withoutDown) return restoreOr(`${label(withoutDown)} has no down.`);

  return {
    mode: 'schema',
    reason: `${input.toVersion} is more than one minor behind; ${changesets.length} changesets are reversed.`,
    schemaChangesets: changesets.map(({ module, id }) => ({ module, id })),
  };
}

/** The sentence the confirmation dialog and `bemmoly rollback` print. */
export function describeRollback(
  decision: RollbackModeDecision,
  toVersion: string,
  discard: { changes: number; people: number; since: Date } | null,
  timeZone: string,
): string {
  switch (decision.mode) {
    case 'code':
      return `Rolling back to ${toVersion} swaps the image only. Nothing is lost.`;
    case 'schema':
      return `Rolling back to ${toVersion} reverses ${decision.schemaChangesets.length} schema changes; fields added since the update are dropped with their columns.`;
    case 'restore': {
      if (!discard) {
        return `Restoring ${toVersion} discards everything written since the pre-upgrade backup.`;
      }
      const at = discard.since.toLocaleString('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
      });
      return `Restoring ${toVersion} will discard ${discard.changes} changes made since ${at} by ${discard.people} ${discard.people === 1 ? 'person' : 'people'}.`;
    }
  }
}
