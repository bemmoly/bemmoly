import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPlanning, type Planning } from '../boards/planning-harness.ts';
import { createRoadmapService } from './index.ts';

/*
 * The roadmap against a real database: a Kanban project whose team finished two issues a
 * week for eight weeks, an epic in flight, another waiting on it, and a version. The clock is
 * fixed at noon on Monday 5 October 2026, so every forecast date can be worked out by hand.
 */

const NOW = new Date('2026-10-05T12:00:00Z');
const WEEK = 7 * 86_400_000;

describe('the roadmap against a real database', () => {
  let planning: Planning | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startPlanning();
    if ('planning' in started) planning = started.planning;
    else skipReason = started.reason;
  });
  afterAll(async () => planning?.stop());

  it('lays out epics and versions with dependencies, forecasts and who may move them', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services, sql } = planning;
    const roadmap = createRoadmapService(planning.deps(() => NOW));
    const ana = await planning.user('Ana');
    const vic = await planning.user('Vic');
    const out = await planning.user('Out');
    const projectId = await planning.project('RMP', 'kanban', [
      [ana, 'member'],
      [vic, 'viewer'],
    ]);
    const as = planning.ctx(ana);
    const [epicType] = await sql<{ id: string }[]>`
      select id from issue_types where project_id is null and key = 'epic'`;
    const epic = (title: string, startAt: string, dueAt: string) =>
      planning!.issue(as, {
        projectId,
        title,
        typeId: epicType?.id ?? '',
        startAt,
        customFields: { target_date: dueAt, owner: ana },
      });
    const billing = await epic('Billing v2', '2026-09-22', '2026-10-21');
    const observability = await epic('Observability', '2026-10-21', '2026-11-25');
    await sql`
      insert into issue_links (source_id, target_id, kind)
      values (${billing.id}, ${observability.id}, 'blocks')`;
    // Only project admins configure versions; the fixture writes the row itself.
    const [version] = await sql<{ id: string }[]>`
      insert into versions (project_id, name, release_at)
      values (${projectId}, '1.0', '2026-11-02') returning id`;

    const children = [];
    for (let index = 0; index < 6; index += 1) {
      children.push(
        await planning.issue(as, { projectId, title: `Billing ${index}`, parentId: billing.id }),
      );
    }
    for (let index = 0; index < 3; index += 1) {
      await planning.issue(as, {
        projectId,
        title: `Observability ${index}`,
        parentId: observability.id,
        fixVersionId: version!.id,
        estimate: 2,
      });
    }
    await planning.setStatus(children[0]!.key, 'Done');
    await planning.setStatus(children[1]!.key, 'Done');

    // Two issues finished in each of the last eight weeks: the team's history.
    const done = await planning.status('Done');
    for (let week = 0; week < 8; week += 1) {
      for (const offset of [1, 3]) {
        const finished = await planning.issue(as, { projectId, title: `Old ${week}.${offset}` });
        await planning.setStatus(finished.key, 'Done');
        const at = new Date(NOW.getTime() - week * WEEK - offset * 86_400_000).toISOString();
        await sql`
          insert into issue_history (issue_id, field, from_value, to_value, created_at)
          values (${finished.id}, 'statusId', 'null'::jsonb, ${JSON.stringify(done)}::jsonb,
            ${at}::timestamptz)`;
      }
    }

    const view = await roadmap.view(as, {});
    expect(view.today).toBe('2026-10-05');
    expect(view.projects).toEqual([
      expect.objectContaining({
        key: 'RMP',
        history: { basis: 'throughput', unit: 'issues', samples: Array(8).fill(2), periodDays: 7 },
      }),
    ]);
    expect(view.dependencies).toEqual([
      expect.objectContaining({ fromId: billing.id, toId: observability.id }),
    ]);
    const byTitle = new Map(view.items.map((item) => [item.title, item]));
    // Four issues left at two a week: two weeks, on track for the 21st.
    expect(byTitle.get('Billing v2')).toMatchObject({
      kind: 'epic',
      key: billing.key,
      start: '2026-09-22',
      end: '2026-10-21',
      endAt: '2026-10-21',
      targetField: 'target_date',
      ownerId: ana,
      progress: { total: 6, done: 2, inProgress: 0 },
      canSchedule: true,
      forecast: { state: 'on_track', likely: '2026-10-19', daysLate: -2, confidence: 'high' },
    });
    expect(byTitle.get('Billing v2')?.children).toHaveLength(6);
    // Starts on the 21st, after Billing v2; three issues take a week and a half.
    expect(byTitle.get('Observability')?.forecast).toMatchObject({
      state: 'on_track',
      likely: '2026-11-01',
      waitsOn: [billing.id],
    });
    expect(byTitle.get('1.0')).toMatchObject({
      kind: 'version',
      end: '2026-11-02',
      canSchedule: false,
      progress: { total: 3, points: 6 },
      forecast: { state: 'on_track', likely: '2026-10-16' },
    });

    // A start moves through the issue PATCH, and a start after the due date is refused.
    await services.issues.update(as, billing.key, { startAt: '2026-09-29' });
    const moved = await roadmap.view(as, { projects: ['RMP'] });
    expect(moved.items.find((item) => item.id === billing.id)?.startAt).toBe('2026-09-29');
    await expect(
      services.issues.update(as, billing.key, { startAt: '2026-10-30' }),
    ).rejects.toMatchObject({ name: 'ValidationError' });

    // A viewer reads it but moves nothing; an outsider sees no project and is refused by key.
    const viewer = await roadmap.view(planning.ctx(vic), {});
    expect(viewer.items.every((item) => !item.canSchedule)).toBe(true);
    expect((await roadmap.view(planning.ctx(out), {})).projects).toEqual([]);
    await expect(roadmap.view(planning.ctx(out), { projects: ['RMP'] })).rejects.toMatchObject({
      name: 'ForbiddenError',
    });
    await expect(roadmap.view(as, { projects: ['NOPE'] })).rejects.toMatchObject({
      name: 'NotFoundError',
    });
  });
});
