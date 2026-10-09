import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';

/* The Backlog mock answers in the order and shapes the screen relies on. */

const BASE = 'http://mock.local/api/v1/work';

interface Row {
  id: string;
  key: string;
  rank: string;
}

interface BacklogBody {
  sprints: Array<{
    sprint: { name: string; state: string };
    issues: Row[];
    committedPoints: number;
  }>;
  issues: Row[];
  epics: Array<{ key: string; done: number; total: number }>;
}

function read(api: ReturnType<typeof createMockApi>): BacklogBody {
  return api.dispatch('GET', `${BASE}/projects/PLT/backlog`, undefined)?.body as BacklogBody;
}

const keys = (rows: Row[]) => rows.map((row) => row.key);

describe('the Backlog mock', () => {
  it('lists the open sprints before the backlog, with the mock epics', () => {
    const backlog = read(createMockApi('ready'));
    expect(backlog.sprints.map((entry) => [entry.sprint.name, entry.sprint.state])).toEqual([
      ['PLT Sprint 14', 'active'],
      ['PLT Sprint 15', 'future'],
    ]);
    expect(keys(backlog.sprints[0]!.issues).slice(0, 2)).toEqual(['PLT-204', 'PLT-218']);
    expect(backlog.sprints[1]!.committedPoints).toBe(19);
    expect(backlog.issues).toHaveLength(8);
    expect(backlog.epics.map((epic) => [epic.key, epic.done, epic.total])).toEqual([
      ['PLT-180', 3, 9],
      ['PLT-150', 8, 12],
      ['PLT-240', 0, 5],
      ['PLT-160', 3, 8],
    ]);
  });

  it('moves an issue between its new neighbours and into another container', () => {
    const api = createMockApi('ready');
    const before = read(api);
    const [first, second] = before.issues;
    const moved = before.sprints[0]!.issues[0]!;
    const result = api.dispatch('POST', `${BASE}/issues/${moved.key}/move`, {
      beforeIssueId: first!.id,
      afterIssueId: second!.id,
      sprintId: null,
    });
    expect(result?.status).toBe(200);
    const after = read(api);
    expect(keys(after.issues).slice(0, 3)).toEqual([first!.key, moved.key, second!.key]);
    expect(keys(after.sprints[0]!.issues)).not.toContain(moved.key);
  });

  it('creates through the issue mock and shows the issue in the container it names', () => {
    const api = createMockApi('ready');
    const sprintIssues = read(api).sprints[1]!.issues;
    const typeId = '018f0000-0000-7000-8000-000000000961';
    const result = api.dispatch('POST', `${BASE}/issues`, {
      projectId: '018f0000-0000-7000-8000-000000000900',
      typeId,
      title: 'Trace IDs in logs',
      sprintId: (sprintIssues[0] as unknown as { sprintId: string }).sprintId,
    });
    expect(result?.status).toBe(201);
    const key = (result?.body as Row).key;
    expect(keys(read(api).sprints[1]!.issues)).toContain(key);
    expect(api.dispatch('GET', `${BASE}/issues/${key}`, undefined)?.status).toBe(200);
  });

  it('starts a sprint only once the active one is complete', () => {
    const api = createMockApi('ready');
    const id = (name: string) =>
      (
        api.dispatch('GET', `${BASE}/projects/PLT/backlog`, undefined)?.body as {
          sprints: Array<{ sprint: { id: string; name: string } }>;
        }
      ).sprints.find((entry) => entry.sprint.name === name)!.sprint.id;
    const next = id('PLT Sprint 15');
    expect(api.dispatch('POST', `${BASE}/sprints/${next}/start`, {})?.status).toBe(409);
    const done = api.dispatch('POST', `${BASE}/sprints/${id('PLT Sprint 14')}/complete`, {
      moveUnfinishedTo: next,
    });
    expect(done?.status).toBe(200);
    expect(read(api).sprints[0]!.issues.length).toBe(12);
    expect(api.dispatch('POST', `${BASE}/sprints/${next}/start`, {})?.status).toBe(200);
  });
});
