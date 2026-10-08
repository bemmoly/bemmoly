import { describe, expect, it } from 'vitest';
import {
  boardConfigSchema,
  completeSprintBodySchema,
  createIssueBodySchema,
  createProjectBodySchema,
  createSprintBodySchema,
  issueKeySchema,
  issueSchema,
  listIssuesQuerySchema,
  listProjectsQuerySchema,
  projectKeySchema,
  rankIssueBodySchema,
  schemeDiffSchema,
  workflowDraftSchema,
} from './index.ts';

const id = '0199c0de-0000-7000-8000-000000000001';
const now = '2026-10-08T09:00:00.000Z';

describe('work shared schemas', () => {
  it('normalises project and issue keys and rejects other spellings', () => {
    expect(projectKeySchema.parse(' plt ')).toBe('PLT');
    expect(projectKeySchema.safeParse('P').success).toBe(false);
    expect(projectKeySchema.safeParse('1PLT').success).toBe(false);
    expect(issueKeySchema.parse('plt-142')).toBe('PLT-142');
    expect(issueKeySchema.safeParse('PLT-0').success).toBe(false);
    expect(issueKeySchema.safeParse('PLT142').success).toBe(false);
  });

  it('fills the defaults a create form leaves out', () => {
    expect(createProjectBodySchema.parse({ key: 'plt', name: 'Platform' })).toEqual({
      key: 'PLT',
      name: 'Platform',
      method: 'scrum',
    });
    const issue = createIssueBodySchema.parse({ projectId: id, typeId: id, title: ' Fix it ' });
    expect(issue).toEqual({ projectId: id, typeId: id, title: 'Fix it', priority: 'medium' });
    expect(createIssueBodySchema.safeParse({ projectId: id, typeId: id, title: '' }).success).toBe(
      false,
    );
  });

  it('pages lists the way the kernel does', () => {
    expect(listProjectsQuerySchema.parse({})).toEqual({ limit: 50, archived: false });
    expect(listProjectsQuerySchema.parse({ limit: '10', archived: 'true' })).toMatchObject({
      limit: 10,
      archived: true,
    });
    expect(listProjectsQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
    expect(listIssuesQuerySchema.parse({ q: 'status != Done' })).toMatchObject({
      q: 'status != Done',
      sort: 'rank',
      order: 'asc',
      limit: 50,
    });
  });

  it('presents an issue with camelCase names and ISO dates', () => {
    const parsed = issueSchema.parse({
      id,
      projectId: id,
      number: 142,
      key: 'PLT-142',
      typeId: id,
      title: 'Ship it',
      description: { type: 'doc', content: [] },
      descriptionText: '',
      statusId: id,
      priority: 'high',
      assigneeId: null,
      reporterId: id,
      parentId: null,
      sprintId: null,
      estimate: 5,
      dueAt: null,
      fixVersionId: null,
      componentId: null,
      customFields: { severity: 'sev2' },
      labelIds: [],
      rank: 'hn',
      statusChangedAt: now,
      resolvedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.key).toBe('PLT-142');
    expect(issueSchema.safeParse({ ...parsed, rank: 'ha' }).success).toBe(false);
    expect(issueSchema.safeParse({ ...parsed, createdAt: 'yesterday' }).success).toBe(false);
  });

  it('describes a drop by its neighbours', () => {
    expect(rankIssueBodySchema.parse({})).toEqual({ beforeIssueId: null, afterIssueId: null });
    expect(rankIssueBodySchema.safeParse({ beforeIssueId: id, afterIssueId: id }).success).toBe(
      false,
    );
  });

  it('keeps sprint dates in order and names where unfinished work goes', () => {
    expect(
      createSprintBodySchema.safeParse({
        name: 'Sprint 12',
        startsAt: '2026-10-08T00:00:00Z',
        endsAt: '2026-10-01T00:00:00Z',
      }).success,
    ).toBe(false);
    expect(completeSprintBodySchema.parse({})).toEqual({ moveUnfinishedTo: 'backlog' });
    expect(completeSprintBodySchema.parse({ moveUnfinishedTo: id })).toEqual({
      moveUnfinishedTo: id,
    });
  });

  it('defaults a board config to the Board Settings mock and needs two columns', () => {
    const config = boardConfigSchema.parse({
      columns: [
        { id: 'todo', name: 'To do', statusIds: [id] },
        { id: 'done', name: 'Done', statusIds: [id], done: true },
      ],
    });
    expect(config.lanes.kind).toBe('none');
    expect(config.estimationUnit).toBe('points');
    expect(config.cadenceDays).toBe(14);
    expect(config.workingDays).toEqual(['mon', 'tue', 'wed', 'thu', 'fri']);
    expect(config.columns[0]?.wipLimit).toBeNull();
    expect(boardConfigSchema.safeParse({ columns: config.columns.slice(0, 1) }).success).toBe(
      false,
    );
  });

  it('accepts a workflow draft with client ids and default rules', () => {
    const draft = workflowDraftSchema.parse({
      statuses: [{ id: 's1', name: 'Backlog', category: 'todo', position: 0 }],
      transitions: [{ id: 't1', fromStatusId: null, toStatusId: 's1', name: 'Close', position: 0 }],
    });
    expect(draft.transitions[0]?.rules).toEqual({
      conditions: [],
      validators: [],
      postActions: [],
    });
    expect(draft.statuses[0]?.allowedRoleIds).toEqual([]);
  });

  it('defaults the attribute list of a scheme diff entry', () => {
    const diff = schemeDiffSchema.parse({
      kind: 'issue_types',
      overridden: true,
      mark: { overriddenAt: now, overriddenBy: id },
      entries: [{ key: 'bug', label: 'Bug', change: 'removed', before: { name: 'Bug' } }],
    });
    expect(diff.entries[0]?.attributes).toEqual([]);
    expect(schemeDiffSchema.safeParse({ ...diff, kind: 'sprints' }).success).toBe(false);
  });
});
