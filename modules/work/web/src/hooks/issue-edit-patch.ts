import type { UpdateIssueBody } from '@bemmoly/module-work/shared';

/*
 * The fields a list screen edits without opening an issue, and the two questions every cache
 * asks of an edit: which of its fields does an entry still hold (only those are taken back when
 * the edit fails), and what were they before (what Undo sends).
 */

export type QuickPatch = Pick<UpdateIssueBody, 'assigneeId' | 'priority' | 'sprintId'>;

export type QuickField = keyof QuickPatch;

export const QUICK_FIELDS: readonly QuickField[] = ['assigneeId', 'priority', 'sprintId'];

type Holder = Partial<Record<QuickField, string | null>>;

/** The edit's fields an entry still holds at the edit's values; absent fields are skipped. */
export function stillHeld(entry: Holder, patch: QuickPatch): QuickField[] {
  return QUICK_FIELDS.filter(
    (field) => patch[field] !== undefined && field in entry && entry[field] === patch[field],
  );
}

/** The values the edit replaces, read from the entry as it was; null when it lacks one. */
export function previousOf(entry: Holder, patch: QuickPatch): QuickPatch | null {
  const before: QuickPatch = {};
  for (const field of QUICK_FIELDS) {
    if (patch[field] === undefined) continue;
    const value = entry[field];
    if (value === undefined) return null;
    if (field === 'priority') {
      if (value === null) return null;
      before.priority = value as NonNullable<QuickPatch['priority']>;
    } else {
      before[field] = value;
    }
  }
  return before;
}
