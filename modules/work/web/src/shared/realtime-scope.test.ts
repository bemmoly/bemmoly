import { WORK_REALTIME_KINDS } from '@bemmoly/module-work/shared';
import { describe, expect, it } from 'vitest';
import { backlogKeys } from '../api/backlog.ts';
import { workSettingsKeys } from '../api/settings.ts';
import { workWorkflowKeys } from '../api/workflows.ts';
import { issueKeys } from '../hooks/issue-keys.ts';
import { workKeys } from './keys.ts';
import { changedBy } from './realtime-scope.ts';

const ISSUE = WORK_REALTIME_KINDS.issue;
const P = '018f0000-0000-7000-8000-000000000050';

describe('changedBy', () => {
  it('refreshes issues and the lists made of them', () => {
    for (const key of [
      workKeys.issue('PLT-1'),
      issueKeys.comments('PLT-1'),
      workKeys.boardView('b'),
      workKeys.boardMetrics('b'),
      workKeys.myIssues(),
      workKeys.sprints(P),
      backlogKeys.backlog('PLT'),
      issueKeys.subtasks('i'),
      workWorkflowKeys.counts('w', P),
    ]) {
      expect(changedBy(ISSUE, key, false), JSON.stringify(key)).toBe(true);
    }
  });

  it('leaves configuration alone', () => {
    for (const key of [
      workKeys.projects(),
      workKeys.workflows(P),
      workKeys.issueTypes(P),
      workKeys.labels(P),
      workKeys.boards(P),
      workSettingsKeys.project(P),
      workSettingsKeys.fields(P),
      workSettingsKeys.schemes(P),
      workWorkflowKeys.list(P),
      workWorkflowKeys.one('w'),
      workWorkflowKeys.draft('w'),
      workWorkflowKeys.rules(),
      issueKeys.people(),
      issueKeys.catalog('PLT', 'types'),
      issueKeys.statuses(P),
    ]) {
      expect(changedBy(ISSUE, key, false), JSON.stringify(key)).toBe(false);
    }
  });

  it('holds board views while a move is in flight', () => {
    expect(changedBy(WORK_REALTIME_KINDS.board, workKeys.boardView('b'), true)).toBe(false);
    expect(changedBy(WORK_REALTIME_KINDS.board, workKeys.issue('PLT-1'), true)).toBe(true);
  });

  it("refreshes everything when a project's members change", () => {
    expect(changedBy(WORK_REALTIME_KINDS.members, workKeys.projects(), false)).toBe(true);
    expect(changedBy(WORK_REALTIME_KINDS.members, workKeys.boards(P), false)).toBe(true);
  });
});
