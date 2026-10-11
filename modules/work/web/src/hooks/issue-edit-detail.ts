import type { IssueDetail } from '@bemmoly/module-work/shared';
import { stillHeld, type QuickPatch } from './issue-edit-patch.ts';

/*
 * A quick edit on the issue's own cached page (the peek and the Issue page), pure. The page
 * prints the assignee's and the sprint's names beside the ids, so the edit brings them when the
 * caller knows them; a name it does not know leaves the old one until the read after it lands.
 */

export interface DetailNames {
  assignee?: IssueDetail['assignee'];
  sprint?: IssueDetail['sprint'];
}

export function patchIssueDetail(
  detail: IssueDetail,
  patch: QuickPatch,
  names: DetailNames = {},
): IssueDetail {
  const next = { ...detail };
  if (patch.assigneeId !== undefined) {
    next.assigneeId = patch.assigneeId;
    if (patch.assigneeId === null) next.assignee = null;
    else if (names.assignee !== undefined) next.assignee = names.assignee;
  }
  if (patch.priority !== undefined) next.priority = patch.priority;
  if (patch.sprintId !== undefined) {
    next.sprintId = patch.sprintId;
    if (patch.sprintId === null) next.sprint = null;
    else if (names.sprint !== undefined) next.sprint = names.sprint;
  }
  return next;
}

/** Takes a failed edit back on the fields that still hold it, names included. */
export function revertIssueDetail(
  detail: IssueDetail,
  before: IssueDetail,
  patch: QuickPatch,
): IssueDetail {
  const held = stillHeld(detail, patch);
  if (held.length === 0) return detail;
  const next = { ...detail };
  if (held.includes('assigneeId')) {
    next.assigneeId = before.assigneeId;
    next.assignee = before.assignee;
  }
  if (held.includes('priority')) next.priority = before.priority;
  if (held.includes('sprintId')) {
    next.sprintId = before.sprintId;
    next.sprint = before.sprint;
  }
  return next;
}
