import type {
  Changelog,
  Changeset,
  ChangelogValidationProblem,
} from '../../contracts/changelog.ts';
import { checksumOf } from './checksum.ts';
import type { HistoryRow } from './store.ts';

/** `0007-issue-rank`: four digits, a dash, lowercase words joined by dashes. */
export const CHANGESET_ID = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*$/;

function problem(
  module: string,
  id: string,
  kind: ChangelogValidationProblem['problem'],
  message: string,
  severity: 'error' | 'warning' = 'error',
): ChangelogValidationProblem {
  return { module, id, problem: kind, message, severity };
}

/** Kernel areas own blocks of 100 prefixes (identity 01xx, email 02xx, ...). */
export const PREFIX_BLOCK = 100;

/**
 * The next prefix continues the sequence, or opens a later block at its first
 * number. Anything else is a gap: a changeset was lost or renumbered.
 */
function followsInOrder(prefix: number, expected: number): boolean {
  return prefix === expected || (prefix > expected && prefix % PREFIX_BLOCK === 0);
}

/** Problems visible from the source alone: ids, order, duplicates, missing `down`. */
export function structuralProblems(
  module: string,
  changelog: Changelog,
): ChangelogValidationProblem[] {
  const problems: ChangelogValidationProblem[] = [];
  const seenIds = new Set<string>();
  const seenPrefixes = new Set<number>();
  let expected = 1;
  for (const changeset of changelog) {
    const match = CHANGESET_ID.exec(changeset.id);
    if (!match) {
      problems.push(
        problem(
          module,
          changeset.id,
          'invalid_id',
          `"${changeset.id}" must look like 0007-short-name`,
        ),
      );
      continue;
    }
    const prefix = Number(match[1]);
    if (seenIds.has(changeset.id) || seenPrefixes.has(prefix)) {
      problems.push(
        problem(
          module,
          changeset.id,
          'duplicate_id',
          `${module}: prefix ${match[1]} is used twice`,
        ),
      );
      continue;
    }
    seenIds.add(changeset.id);
    seenPrefixes.add(prefix);
    if (!followsInOrder(prefix, expected)) {
      problems.push(
        problem(
          module,
          changeset.id,
          'gap_in_order',
          `${module}: expected prefix ${String(expected).padStart(4, '0')} before ${changeset.id}`,
        ),
      );
    }
    expected = prefix + 1;
    if (!changeset.down && !changeset.irreversible) {
      problems.push(
        problem(
          module,
          changeset.id,
          'missing_down',
          `${module}/${changeset.id} has no down; add one, or set irreversible: true when data is lost`,
        ),
      );
    }
  }
  return problems;
}

export function acceptsChecksum(changeset: Changeset, recorded: string): boolean {
  if (checksumOf(changeset) === recorded) return true;
  return (changeset.validChecksums ?? []).some((valid) => valid.checksum === recorded);
}

/** Recorded rows compared with the source: changed checksums and unknown ids. */
export function historyProblems(
  module: string,
  changelog: Changelog,
  history: readonly HistoryRow[],
): ChangelogValidationProblem[] {
  const byId = new Map(changelog.map((changeset) => [changeset.id, changeset]));
  const problems: ChangelogValidationProblem[] = [];
  for (const row of history) {
    if (row.module !== module || row.state === 'rolled_back') continue;
    const changeset = byId.get(row.id);
    if (!changeset) {
      problems.push(
        problem(
          module,
          row.id,
          'unknown_changeset',
          `${module}/${row.id} is recorded as ${row.state} but is not in this image (a newer release ran it)`,
          'warning',
        ),
      );
      continue;
    }
    if (changeset.runOnChange || changeset.runAlways) continue;
    if (!acceptsChecksum(changeset, row.checksum)) {
      problems.push(
        problem(
          module,
          row.id,
          'checksum_mismatch',
          `${changeset.source?.file ?? `${module}/${row.id}`} changed after it ran: recorded ${row.checksum}, now ${checksumOf(changeset)}. ` +
            'Revert the edit, or list the recorded checksum in validChecksums with a reason.',
        ),
      );
    }
  }
  return problems;
}

export function isError(problem: ChangelogValidationProblem): boolean {
  return (problem.severity ?? 'error') === 'error';
}
