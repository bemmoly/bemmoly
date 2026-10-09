import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';
import { WORK_IDS } from '../seed/work-settings.ts';
import { TYPE_IDS } from '../seed/work-types.ts';

/* The Issue, Backlog and Board mocks read and write one store of issues with one key counter. */

const W = 'http://mock.local/api/v1/work';

interface Issue {
  id: string;
  key: string;
  sprintId: string | null;
  statusId: string;
}

type Api = ReturnType<typeof createMockApi>;

const get = <T>(api: Api, path: string) => api.dispatch('GET', `${W}${path}`, undefined)?.body as T;
const issue = (api: Api, key: string) => get<Issue>(api, `/issues/${key}`);
const backlog = (api: Api) =>
  get<{ sprints: Array<{ sprint: { id: string }; issues: Issue[] }>; issues: Issue[] }>(
    api,
    '/projects/PLT/backlog',
  );
const boardCards = (api: Api) =>
  get<{ cards: Array<{ key: string; statusId: string }> }>(api, `/boards/${WORK_IDS.board}/view`)
    .cards;

describe('the shared Work issue store', () => {
  it('counts issues per status for one project or for every project', () => {
    const api = createMockApi('ready');
    const counts = (query: string) =>
      get<{ counts: Record<string, number> }>(
        api,
        `/workflows/${WORK_IDS.workflow}/status-counts${query}`,
      ).counts;
    const total = (map: Record<string, number>) => Object.values(map).reduce((a, b) => a + b, 0);
    const plt = get<{ items: Issue[] }>(api, `/issues?projectId=${WORK_IDS.project}`).items;
    expect(total(counts(`?projectId=${WORK_IDS.project}`))).toBe(plt.length);
    expect(total(counts(''))).toBeGreaterThan(plt.length);
  });

  it('shows a backlog move in the issue the slide-over opens', () => {
    const api = createMockApi('ready');
    const moved = backlog(api).issues[0]!;
    const next = backlog(api).sprints[1]!.sprint.id;
    const result = api.dispatch('POST', `${W}/issues/${moved.key}/move`, { sprintId: next });
    expect(result?.status).toBe(200);
    expect(issue(api, moved.key).sprintId).toBe(next);
  });

  it('gives inline create the next free key, shown on every screen', () => {
    const api = createMockApi('ready');
    const sprint = backlog(api).sprints[0]!.sprint.id;
    const taken = new Set(get<{ items: Issue[] }>(api, '/issues').items.map((row) => row.key));
    const created = api.dispatch('POST', `${W}/issues`, {
      projectId: WORK_IDS.project,
      typeId: TYPE_IDS['task'],
      title: 'Trace IDs in logs',
      sprintId: sprint,
    })?.body as Issue;
    expect(taken.has(created.key)).toBe(false);
    expect(created.key).toBe('PLT-247');
    expect(issue(api, created.key).id).toBe(created.id);
    expect(backlog(api).sprints[0]!.issues.map((row) => row.key)).toContain(created.key);
    expect(boardCards(api).map((card) => card.key)).toContain(created.key);
  });

  it('shows a status change made on the issue page on the board and in the backlog', () => {
    const api = createMockApi('ready');
    const card = boardCards(api).find((entry) => entry.key === 'PLT-204')!;
    const other = boardCards(api).find((entry) => entry.statusId !== card.statusId)!;
    const transitions = get<{ items: Array<{ toStatusId: string; available: boolean }> }>(
      api,
      '/issues/PLT-204/transitions',
    ).items.filter((entry) => entry.available);
    const target = transitions[0]?.toStatusId ?? other.statusId;
    expect(api.dispatch('PATCH', `${W}/issues/PLT-204`, { statusId: target })?.status).toBe(200);
    expect(boardCards(api).find((entry) => entry.key === 'PLT-204')?.statusId).toBe(target);
    const rows = backlog(api).sprints.flatMap((entry) => entry.issues);
    expect(rows.find((row) => row.key === 'PLT-204')?.statusId).toBe(target);
  });
});
