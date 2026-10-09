import { WORK_REALTIME_KINDS } from '@bemmoly/module-work/shared';
import type { QueryKey } from '@tanstack/react-query';

/*
 * Which cached reads a Work realtime event can have changed. Issue, sprint and
 * board events change issues and the lists made of them; they never change a
 * project's configuration (its workflows, types, fields, labels, boards and
 * schemes) or the workspace's people. Refetching those on every event made a
 * burst of changes cost every open screen a dozen reads per event.
 */

/** Second key segments of configuration reads under the work root. */
const CONFIGURATION = new Set([
  'projects',
  'project-key',
  'workflows',
  'workflow-rules',
  'catalog',
  'statuses',
  'people',
  'org',
  'issue-type',
]);

/** Fourth key segments of a project's own configuration reads: ['work', 'project', id, …]. */
const PROJECT_CONFIGURATION = new Set([
  'workflows',
  'issue-types',
  'labels',
  'boards',
  'schemes',
  'fields',
]);

export function changedBy(kind: string, key: QueryKey, boardMoving: boolean): boolean {
  const [, group, , part] = key;
  // While cards are being moved, a board view read now would lack the moves still in flight
  // and put their cards back; the last move to settle reads the board again.
  if (group === 'board-view') return !boardMoving;
  // Membership decides which projects someone sees, so it touches everything.
  if (kind === WORK_REALTIME_KINDS.members) return true;
  if (typeof group !== 'string') return true;
  // One workflow's issue counts move with its issues; the workflow itself does not.
  if (group === 'workflow') return part === 'counts';
  if (CONFIGURATION.has(group)) return false;
  if (group === 'project') return !(key.length === 3 || PROJECT_CONFIGURATION.has(String(part)));
  return true;
}
