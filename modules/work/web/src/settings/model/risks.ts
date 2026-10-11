import type { BoardConfig, WorkMethod } from '@bemmoly/module-work/shared';
import type { ConfirmChangeProps } from '@bemmoly/ui';
import { hiddenWork, issuesIn, type StatusInfo } from './columns.ts';

/** What a risky change needs said before it is saved; spread onto ConfirmChange. */
export type ChangeConfirm = Pick<
  ConfirmChangeProps,
  'title' | 'description' | 'consequences' | 'confirmWord' | 'confirmLabel' | 'tone'
>;

const issues = (count: number) => `${count} ${count === 1 ? 'issue' : 'issues'}`;

/**
 * Asks before a column change that takes cards off the board: a removed
 * column that holds issues, or a status that leaves every column. Nothing is
 * deleted; the issues come back when their status is mapped again.
 */
export function columnsRisk(
  before: BoardConfig,
  after: BoardConfig,
  statuses: readonly StatusInfo[],
  counts: Record<string, number>,
): ChangeConfirm | null {
  const hidden = hiddenWork(before, after, statuses, counts);
  if (hidden.total === 0) return null;
  return {
    title: `Take ${issues(hidden.total)} off the board?`,
    description: 'The issues keep their status; they only stop showing on this board.',
    consequences: [
      ...hidden.removedColumns.map(
        (column) =>
          `"${column.name}" is removed, and its ${issues(column.issues)} leave the board.`,
      ),
      ...hidden.unmapped.map(
        (status) =>
          `${status.name} is in no column, so its ${issues(status.issues)} leave the board.`,
      ),
      'Map the statuses to a column again to bring the cards back.',
    ],
    confirmLabel: 'Save and hide cards',
    tone: 'caution',
  };
}

/**
 * Switching a Kanban project to Scrum hides every card that is not in an
 * active sprint, and a Kanban project has none, so the board empties until a
 * sprint starts.
 */
export function methodRisk(
  before: WorkMethod,
  after: WorkMethod,
  config: BoardConfig,
  counts: Record<string, number>,
): ChangeConfirm | null {
  if (before !== 'kanban' || after !== 'scrum') return null;
  const onBoard = issuesIn(
    config.columns.flatMap((column) => column.statusIds),
    counts,
  );
  if (onBoard === 0) return null;
  return {
    title: 'Switch this board to Scrum?',
    description: 'Scrum boards show the active sprint only.',
    consequences: [
      `The ${issues(onBoard)} on the board leave it until they are planned into a sprint and the sprint starts.`,
      'WIP limits stay; cycle time history is kept and velocity starts with the first closed sprint.',
      'You can switch back to Kanban later; nothing is deleted.',
    ],
    confirmLabel: 'Switch to Scrum',
    tone: 'caution',
  };
}

/** Resetting drops every board setting this project changed, so it asks for a typed word. */
export function resetRisk(changes: number): ChangeConfirm {
  return {
    title: 'Reset the board to the org default?',
    description: 'The diff above lists every setting that goes back.',
    consequences: [
      `${changes} ${changes === 1 ? 'setting this project changed is' : 'settings this project changed are'} replaced by the org default.`,
      'Columns are matched to this project’s statuses by name; unmatched statuses leave the board.',
      'Personal filters and swimlane views of members are not touched.',
    ],
    confirmWord: 'reset',
    confirmLabel: 'Reset to org default',
    tone: 'danger',
  };
}
