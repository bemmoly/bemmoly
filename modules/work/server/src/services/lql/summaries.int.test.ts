import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { issueSummariesPageSchema, issuesPageSchema } from '../../../../shared/issues.ts';
import { startWorkHttp, type WorkHttp } from '../../testing/http-support.ts';
import { startWorkHarness, type WorkHarness } from '../int-support.ts';

/*
 * The issue summaries a document's live table draws, through the real routes: one request
 * brings each row's type, status and assignee, keeps to the projects the reader may view,
 * and pages exactly as the query endpoint does.
 */

describe('issue summaries for a query', () => {
  let harness: WorkHarness | null = null;
  let http: WorkHttp | null = null;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startWorkHarness();
    if (started.available) {
      harness = started.harness;
      http = await startWorkHttp(harness);
    } else skipReason = started.reason;
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  const get = (path: string, userId: string, query: Record<string, string> = {}) =>
    http!.get(path, userId, query);

  it('returns each row with type, status and assignee in one call', async (ctx) => {
    if (!harness || !http) return ctx.skip(skipReason);
    const { users } = harness;
    const open = await harness.project('SUM', [users.member]);
    const closed = await harness.project('HID');
    const first = await harness.issue(open, 'Cache warmup', { assigneeId: users.member });
    const second = await harness.issue(open, 'Index rebuild');
    const third = await harness.issue(open, 'Session store');
    const hidden = await harness.issue(closed, 'Payroll export');

    const lql = 'ORDER BY created ASC';
    const response = await get('/issues/summaries', users.member, { lql, limit: '2' });
    expect(response.statusCode).toBe(200);
    const page = issueSummariesPageSchema.parse(response.json());
    expect(page.items).toEqual([
      {
        id: first.id,
        key: first.key,
        title: 'Cache warmup',
        type: expect.objectContaining({ key: 'task', level: 'standard' }),
        status: expect.objectContaining({ id: first.statusId, category: 'todo' }),
        assignee: { id: users.member, name: 'mo' },
      },
      expect.objectContaining({ key: second.key, title: 'Index rebuild', assignee: null }),
    ]);
    expect(page.items[0]?.status.name).toBeTruthy();
    expect(page.items[0]?.type.name).toBeTruthy();

    const query = issuesPageSchema.parse(
      (await get('/issues/query', users.member, { lql, limit: '2' })).json(),
    );
    expect(page.nextCursor).toBe(query.nextCursor);
    expect(page.items.map((item) => item.id)).toEqual(query.items.map((item) => item.id));

    const rest = issueSummariesPageSchema.parse(
      (
        await get('/issues/summaries', users.member, { lql, limit: '2', cursor: page.nextCursor! })
      ).json(),
    );
    expect(rest.items.map((item) => item.key)).toEqual([third.key]);
    expect(rest.nextCursor).toBeNull();

    const everything = issueSummariesPageSchema.parse(
      (await get('/issues/summaries', users.admin, { lql, limit: '10' })).json(),
    );
    expect(everything.items.map((item) => item.key)).toContain(hidden.key);
    const detail = await get(`/issues/${first.key}`, users.member);
    expect(detail.json()).toMatchObject({ key: first.key, title: 'Cache warmup' });
  });

  it('keeps to the projects the reader may view', async (ctx) => {
    if (!harness || !http) return ctx.skip(skipReason);
    const { users } = harness;
    const secret = await harness.project('SEC');
    const issue = await harness.issue(secret, 'Board minutes');

    const member = issueSummariesPageSchema.parse(
      (await get('/issues/summaries', users.member, { lql: 'project = SEC', limit: '10' })).json(),
    );
    expect(member.items).toEqual([]);
    const outsider = issueSummariesPageSchema.parse(
      (await get('/issues/summaries', users.outsider, { limit: '10' })).json(),
    );
    expect(outsider.items).toEqual([]);
    const admin = issueSummariesPageSchema.parse(
      (await get('/issues/summaries', users.admin, { lql: 'project = SEC', limit: '10' })).json(),
    );
    expect(admin.items.map((item) => item.key)).toEqual([issue.key]);

    const scoped = await get('/issues/summaries', users.member, { projectId: secret.id });
    expect(scoped.statusCode).toBe(403);
    const broken = await get('/issues/summaries', users.member, { lql: 'status = = Done' });
    expect(broken.statusCode).toBe(400);
  });
});
