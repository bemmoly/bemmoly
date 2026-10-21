import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';
import { RULE_IDS } from '../seed/work-automation.ts';
import { WORK_IDS } from '../seed/work-settings.ts';

/* The automation mock answers as Work's automation service does. */

const A = 'http://mock.local/api/v1/work/automation';

type Row = Record<string, unknown> & { id: string };

const rules = (api: ReturnType<typeof createMockApi>, projectId?: string) =>
  (
    api.dispatch('GET', `${A}/rules${projectId ? `?projectId=${projectId}` : ''}`, undefined)
      ?.body as { items: Row[] }
  ).items;

const runs = (api: ReturnType<typeof createMockApi>, query = '') =>
  api.dispatch('GET', `${A}/runs${query}`, undefined)?.body as {
    items: Row[];
    nextCursor: string | null;
  };

const rule = {
  name: 'Label new work',
  projectId: WORK_IDS.project,
  trigger: { name: 'issue_created', args: {} },
  conditions: [],
  actions: [{ name: 'add_label', args: { label: 'infra' } }],
};

describe('the automation mock', () => {
  it("lists a project's rules with the global ones, and only global ones without a project", () => {
    const api = createMockApi('ready');
    expect(rules(api, WORK_IDS.project)).toHaveLength(4);
    expect(rules(api).map((row) => row.projectId)).toEqual([null]);
  });

  it('saves a rule as the person who saved it and refuses one without actions', () => {
    const api = createMockApi('ready');
    expect(api.dispatch('POST', `${A}/rules`, { ...rule, actions: [] })?.status).toBe(400);
    const scheduled = { ...rule, trigger: { name: 'scheduled', args: { cron: '0 9 * * 1' } } };
    expect(api.dispatch('POST', `${A}/rules`, scheduled)?.status).toBe(400);
    const stay = (status: string) => ({
      ...rule,
      trigger: { name: 'time_in_status', args: { status, amount: 5, unit: 'days' } },
    });
    expect(api.dispatch('POST', `${A}/rules`, stay(''))?.status).toBe(400);
    expect(api.dispatch('POST', `${A}/rules`, stay('Verification'))?.status).toBe(201);
    const saved = api.dispatch('POST', `${A}/rules`, rule);
    expect(saved?.status).toBe(201);
    expect(saved?.body).toMatchObject({ ownerName: 'Rohan S.', enabled: false });
  });

  it('keeps global rules to org admins and project rules to project configurers', () => {
    const api = createMockApi('member');
    const off = api.dispatch('PATCH', `${A}/rules/${RULE_IDS.reopen}`, { enabled: false });
    expect(off?.status).toBe(403);
    expect(api.dispatch('POST', `${A}/rules`, rule)?.status).toBe(403);
  });

  it('queues a test run that finishes as the log is read', () => {
    const api = createMockApi('ready');
    const missing = api.dispatch('POST', `${A}/rules/${RULE_IDS.triage}/runs`, {
      issueKey: 'PLT-9999',
    });
    expect(missing?.status).toBe(400);
    const queued = api.dispatch('POST', `${A}/rules/${RULE_IDS.triage}/runs`, {
      issueKey: 'plt-204',
    })?.body as Row;
    expect(queued).toMatchObject({ status: 'queued', trigger: 'test', issueKey: 'PLT-204' });
    runs(api);
    const done = runs(api).items.find((run) => run.id === queued.id);
    expect(done?.['status']).toBe('succeeded');
  });

  it('shows a run the loop guard stopped, and pages the log', () => {
    const api = createMockApi('ready');
    const skipped = runs(api, '?status=skipped').items;
    const loop = skipped.find((run) => Number(run['depth']) === 5);
    expect(loop?.['error']).toBe('Stopped: rules triggered each other 5 times in a row.');
    const first = runs(api, `?projectId=${WORK_IDS.project}`);
    expect(first.items).toHaveLength(25);
    expect(first.nextCursor).not.toBeNull();
  });
});
