import type {
  ChangelogEntry,
  ChangelogValidationProblem,
  PendingChangeset,
} from '../../contracts/changelog.ts';
import type { PlannedChangeset } from './plan.ts';
import type { RollbackPlan } from './rollback.ts';

function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => (row[column] ?? '').length)),
  );
  const line = (cells: readonly string[]) =>
    cells
      .map((cell, column) => cell.padEnd(widths[column] ?? 0))
      .join('  ')
      .trimEnd();
  return [line(header), ...rows.map(line)].join('\n');
}

export function formatPending(pending: readonly PendingChangeset[]): string {
  if (pending.length === 0) return 'Up to date: no pending changesets.';
  const byModule = new Map<string, string[]>();
  for (const item of pending)
    byModule.set(item.module, [...(byModule.get(item.module) ?? []), item.id]);
  const lines = [...byModule].map(
    ([module, ids]) => `${module}: ${ids.length} pending\n  ${ids.join('\n  ')}`,
  );
  return lines.join('\n');
}

export function formatProblems(problems: readonly ChangelogValidationProblem[]): string {
  if (problems.length === 0) return 'Changelog is valid.';
  return problems
    .map(
      (p) =>
        `${(p.severity ?? 'error').toUpperCase()} ${p.problem} ${p.module}/${p.id}: ${p.message}`,
    )
    .join('\n');
}

export function formatHistory(rows: readonly (ChangelogEntry & { tag?: string | null })[]): string {
  if (rows.length === 0) return 'No changesets recorded.';
  return table(
    ['#', 'module', 'id', 'state', 'author', 'executed at', 'ms', 'version', 'tag'],
    rows.map((row) => [
      String(row.orderExecuted),
      row.module,
      row.id,
      row.state,
      row.author,
      row.executedAt.toISOString(),
      String(row.executionMs),
      row.appVersion,
      row.tag ?? '',
    ]),
  );
}

export function formatPlan(planned: readonly PlannedChangeset[]): string {
  if (planned.length === 0) return '-- Up to date: nothing to run.';
  return planned
    .map((entry) => {
      const header = [
        `-- ${entry.module}/${entry.id}: ${entry.description}`,
        `-- action: ${entry.action}${entry.transactional ? '' : ' (not transactional)'}`,
        ...(entry.note ? [`-- note: ${entry.note}`] : []),
      ];
      return [...header, ...entry.statements].join('\n');
    })
    .join('\n\n');
}

export function formatRollback(plan: RollbackPlan): string {
  if (plan.steps.length === 0) return 'Nothing to roll back.';
  const lines = plan.steps.map(
    (step) =>
      `${step.reversible ? 'down' : 'IRREVERSIBLE'} ${step.module}/${step.id}${step.blocker ? ` (${step.blocker})` : ''}`,
  );
  if (plan.irreversible.length > 0) {
    lines.push('', 'A rollback past an irreversible changeset needs the pre-upgrade backup.');
  }
  return lines.join('\n');
}
