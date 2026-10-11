import { ForbiddenError, NotFoundError, ValidationError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

describe('issues against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (start.available) work = start.harness;
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('numbers twenty concurrent creates in one project without a gap or a repeat', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const project = await work.project('NUM');
    const created = await Promise.all(
      Array.from({ length: 20 }, (_, index) => work.issue(project, `Concurrent ${index}`)),
    );
    const numbers = created.map((issue) => issue.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(new Set(created.map((issue) => issue.key)).size).toBe(20);
    for (const issue of created) expect(issue.key).toBe(`NUM-${issue.number}`);
    // Each create appends to the board, so no two of them may share a rank.
    expect(new Set(created.map((issue) => issue.rank)).size).toBe(20);
    const [counter] = await work.sql<{ next_number: number }[]>`
      select next_number from project_counters where project_id = ${project.id}`;
    expect(counter?.next_number).toBe(21);
  });

  it('keeps numbering per project, so two projects both start at one', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const [a, b] = await Promise.all([work.project('ALPHA'), work.project('BETA')]);
    const issues = await Promise.all([
      work.issue(a, 'First in alpha'),
      work.issue(b, 'First in beta'),
      work.issue(a, 'Second in alpha'),
    ]);
    expect(issues.map((issue) => issue.key).sort()).toEqual(['ALPHA-1', 'ALPHA-2', 'BETA-1']);
  });

  it('soft deletes, hides and restores an issue with a history row each way', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const project = await work.project('DEL', [work.users.member]);
    const issue = await work.issue(project, 'Delete me');
    const admin = work.as(work.users.admin);

    await expect(
      work.services.issues.remove(work.as(work.users.member), issue.key),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await work.services.issues.remove(admin, issue.key);

    await expect(
      work.services.issues.update(admin, issue.key, { title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const live = await work.services.issues.list(admin, {
      projectId: project.id,
      limit: 50,
      sort: 'created',
      order: 'asc',
      deleted: false,
    });
    expect(live.items.map((item) => item.key)).not.toContain(issue.key);
    const trash = await work.services.issues.list(admin, {
      projectId: project.id,
      limit: 50,
      sort: 'created',
      order: 'asc',
      deleted: true,
    });
    expect(trash.items.map((item) => item.key)).toEqual([issue.key]);
    const found = await work.services.search.suggest(admin, { q: issue.key, limit: 8 });
    expect(found).toEqual([]);

    const restored = await work.services.issues.restore(admin, issue.key);
    expect(restored.deletedAt).toBeNull();
    const history = await work.services.history.list(admin, issue.key, {
      limit: 50,
      field: 'deleted',
    });
    expect(history.items.map((entry) => [entry.from, entry.to])).toEqual([
      [true, null],
      [null, true],
    ]);
  });
  it('refuses a label, version or component of another project', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const admin = work.as(work.users.admin);
    const home = await work.project('HOME');
    await work.project('AWAY');
    const label = await work.services.labels.create(admin, 'AWAY', { name: 'away' });
    const version = await work.services.versions.create(admin, 'AWAY', { name: '1.0' });
    const component = await work.services.components.create(admin, 'AWAY', { name: 'Away' });
    await expect(
      work.issue(home, 'Borrowed label', { labelIds: [label.id] }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      work.issue(home, 'Borrowed version', { fixVersionId: version.id }),
    ).rejects.toBeInstanceOf(ValidationError);
    const issue = await work.issue(home, 'Stays home');
    for (const patch of [
      { labelIds: [label.id] },
      { fixVersionId: version.id },
      { componentId: component.id },
    ]) {
      await expect(work.services.issues.update(admin, issue.key, patch)).rejects.toBeInstanceOf(
        ValidationError,
      );
    }
    const own = await work.services.versions.create(admin, 'HOME', { name: '1.0' });
    const updated = await work.services.issues.update(admin, issue.key, { fixVersionId: own.id });
    expect(updated.fixVersionId).toBe(own.id);
  });
});
