import type { JobRegistry, RequestContext, SqlExecutor } from '@bemmoly/core';
import { describe, expect, it, vi } from 'vitest';
import { WORK_AUTOMATION_RUN_JOB } from '../../jobs.ts';
import type { WorkflowIssue } from '../contract.ts';
import { findRule, parseRuleArgs, ruleCatalog, runChecks, runPostAction } from './index.ts';
import type { RuleContext } from './types.ts';

const uid = (n: number) => `0199c0de-0000-7000-8000-00000000000${n}`;

const issue: WorkflowIssue = {
  id: uid(1),
  key: 'PLT-1',
  project_id: uid(2),
  type_id: uid(3),
  status_id: uid(4),
  assignee_id: null,
  reporter_id: uid(5),
  sprint_id: uid(6),
  estimate: null,
  resolved_at: null,
  custom_fields: { reviewer: uid(7), pull_request: '' },
};

function contextWith(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    ctx: { actor: { kind: 'user', id: uid(8) }, authz: {} as never } as RequestContext,
    sql: {} as SqlExecutor,
    issue,
    toStatus: { id: uid(9), name: 'Done', category: 'done' },
    submitted: {},
    reads: { openSubtasks: async () => 0, unresolvedLinkedIssues: async () => 0 },
    writes: { setField: vi.fn(async () => undefined) },
    ...overrides,
  };
}

const check = (name: string, args: Record<string, unknown>, rc: RuleContext) =>
  runChecks([{ name, args }], 'condition', rc);
const validate = (name: string, args: Record<string, unknown>, rc: RuleContext) =>
  runChecks([{ name, args }], 'validator', rc);

describe('conditions', () => {
  it('field_set reads custom fields, columns and the submitted form, in that order of override', async () => {
    const rc = contextWith();
    expect(await check('field_set', { field: 'reviewer' }, rc)).toEqual({ ok: true });
    expect(await check('field_set', { field: 'pull_request' }, rc)).toEqual({
      ok: false,
      reasons: ['pull_request must be set'],
    });
    expect(await check('field_set', { field: 'assignee_id' }, rc)).toMatchObject({ ok: false });
    const submitted = contextWith({ submitted: { pull_request: 'org/repo#12' } });
    expect(await check('field_set', { field: 'pull_request' }, submitted)).toEqual({ ok: true });
  });

  it('subtasks_done and linked_issues_resolved count what is still open', async () => {
    const open = contextWith({
      reads: { openSubtasks: async () => 2, unresolvedLinkedIssues: async () => 1 },
    });
    expect(await check('subtasks_done', {}, open)).toEqual({
      ok: false,
      reasons: ['2 subtasks are still open'],
    });
    expect(await check('linked_issues_resolved', {}, open)).toEqual({
      ok: false,
      reasons: ['1 blocking issue is not resolved'],
    });
    expect(await check('subtasks_done', {}, contextWith())).toEqual({ ok: true });
    expect(await check('linked_issues_resolved', {}, contextWith())).toEqual({ ok: true });
  });

  it('lql_query refuses to pass without an evaluator and asks it when there is one', async () => {
    expect(await check('lql_query', { query: 'priority = high' }, contextWith())).toEqual({
      ok: false,
      reasons: ['Query conditions are not available on this install'],
    });
    const matches = vi.fn(async () => true);
    const rc = contextWith({ lql: { matches } });
    expect(await check('lql_query', { query: 'priority = high' }, rc)).toEqual({ ok: true });
    expect(matches).toHaveBeenCalledWith(rc.sql, issue.id, 'priority = high');
    expect(parseRuleArgs(findRule('lql_query')!, { query: 'priority =' })).toMatchObject({
      ok: false,
    });
  });
});

describe('validators', () => {
  it('required_fields names every missing field at once', async () => {
    const rc = contextWith({ submitted: { comment: 'done' } });
    expect(await validate('required_fields', { fields: ['reviewer', 'comment'] }, rc)).toEqual({
      ok: true,
    });
    expect(
      await validate('required_fields', { fields: ['assignee_id', 'pull_request'] }, rc),
    ).toEqual({ ok: false, reasons: ['Fill in assignee_id, pull_request'] });
  });

  it('estimate_set wants a positive number from the issue or the form', async () => {
    expect(await validate('estimate_set', {}, contextWith())).toEqual({
      ok: false,
      reasons: ['Add an estimate'],
    });
    expect(await validate('estimate_set', {}, contextWith({ submitted: { estimate: 3 } }))).toEqual(
      { ok: true },
    );
    const stored = contextWith({ issue: { ...issue, estimate: '5.00' } });
    expect(await validate('estimate_set', {}, stored)).toEqual({ ok: true });
  });

  it('comment_required reads the comment the form sent', async () => {
    expect(await validate('comment_required', {}, contextWith())).toEqual({
      ok: false,
      reasons: ['Add a comment'],
    });
    const short = contextWith({ submitted: { comment: 'ok' } });
    expect(await validate('comment_required', { minLength: 10 }, short)).toEqual({
      ok: false,
      reasons: ['The comment needs at least 10 characters'],
    });
    expect(await validate('comment_required', {}, short)).toEqual({ ok: true });
  });

  it('reports a rule in the wrong slot or with bad params instead of passing it', async () => {
    const rc = contextWith();
    expect(await validate('field_set', { field: 'x' }, rc)).toEqual({
      ok: false,
      reasons: ['Unknown validator "field_set"'],
    });
    expect(await check('field_set', {}, rc)).toEqual({
      ok: false,
      reasons: ['Field is set: field: Invalid input: expected string, received undefined'],
    });
  });
});

describe('post-actions', () => {
  it('assign_to_reporter and clear_sprint write through the issue writes with history', async () => {
    const rc = contextWith();
    await runPostAction({ name: 'assign_to_reporter', args: {} }, rc);
    await runPostAction({ name: 'clear_sprint', args: {} }, rc);
    expect(rc.writes.setField).toHaveBeenNthCalledWith(
      1,
      rc.sql,
      issue.id,
      uid(8),
      'assignee_id',
      uid(5),
    );
    expect(rc.writes.setField).toHaveBeenNthCalledWith(2, rc.sql, issue.id, uid(8), 'sprint_id', null);
  });

  it('skips a write that would change nothing', async () => {
    const rc = contextWith({ issue: { ...issue, assignee_id: uid(5), sprint_id: null } });
    await runPostAction({ name: 'assign_to_reporter', args: {} }, rc);
    await runPostAction({ name: 'clear_sprint', args: {} }, rc);
    await runPostAction({ name: 'set_resolution', args: { resolved: false } }, rc);
    expect(rc.writes.setField).not.toHaveBeenCalled();
  });

  it('set_resolution stamps now and can clear it again', async () => {
    const rc = contextWith();
    await runPostAction({ name: 'set_resolution', args: {} }, rc);
    expect(rc.writes.setField).toHaveBeenCalledWith(
      rc.sql,
      issue.id,
      uid(8),
      'resolved_at',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );
    const resolved = contextWith({ issue: { ...issue, resolved_at: '2026-10-08T00:00:00Z' } });
    await runPostAction({ name: 'set_resolution', args: { resolved: false } }, resolved);
    expect(resolved.writes.setField).toHaveBeenCalledWith(
      resolved.sql,
      issue.id,
      uid(8),
      'resolved_at',
      null,
    );
  });

  it('fire_automation enqueues the automation job with the issue and the target', async () => {
    const send = vi.fn(async () => 'job-1');
    const rc = contextWith({
      jobs: { send, add: vi.fn() } as unknown as JobRegistry,
      ctx: { actor: { kind: 'user', id: uid(8) }, authz: {} as never, requestId: 'req-1' },
    });
    await runPostAction({ name: 'fire_automation', args: { ruleId: uid(9) } }, rc);
    expect(send).toHaveBeenCalledWith(
      WORK_AUTOMATION_RUN_JOB,
      { ruleId: uid(9), issueId: issue.id, toStatusId: uid(9) },
      { requestId: 'req-1' },
    );
    await expect(
      runPostAction({ name: 'fire_automation', args: { ruleId: uid(9) } }, contextWith()),
    ).rejects.toThrow('job queue');
  });
});

describe('catalog', () => {
  it('lists every rule with a JSON schema and says which are not available', () => {
    const catalog = ruleCatalog({});
    expect(catalog.map((rule) => rule.name)).toEqual([
      'field_set',
      'subtasks_done',
      'linked_issues_resolved',
      'lql_query',
      'required_fields',
      'estimate_set',
      'comment_required',
      'assign_to_reporter',
      'clear_sprint',
      'set_resolution',
      'fire_automation',
    ]);
    expect(catalog.find((rule) => rule.name === 'lql_query')?.available).toBe(false);
    expect(catalog.find((rule) => rule.name === 'fire_automation')?.available).toBe(false);
    expect(catalog.find((rule) => rule.name === 'required_fields')?.params).toMatchObject({
      type: 'object',
      required: ['fields'],
    });
    const wired = ruleCatalog({ lql: { matches: async () => true }, jobs: {} as JobRegistry });
    expect(wired.every((rule) => rule.available)).toBe(true);
  });
});
