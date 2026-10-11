import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

describe('labels, versions and components against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let project: Project;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    project = await work.project('CAT', [work.users.member]);
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('pages labels by name and filters them by a prefix for pickers', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const member = work.as(work.users.member);
    for (const name of ['frontend', 'Backend', 'flaky', 'docs', 'FROZEN', '50%_off']) {
      await work.services.labels.create(member, 'CAT', { name });
    }
    const first = await work.services.labels.list(member, 'CAT', { limit: 4 });
    expect(first.items.map((label) => label.name)).toEqual(['50%_off', 'Backend', 'docs', 'flaky']);
    const rest = await work.services.labels.list(member, 'CAT', {
      limit: 4,
      cursor: first.nextCursor ?? undefined,
    });
    expect(rest.items.map((label) => label.name)).toEqual(['frontend', 'FROZEN']);
    expect(rest.nextCursor).toBeNull();
    const picked = await work.services.labels.list(member, 'CAT', { limit: 50, q: 'FR' });
    expect(picked.items.map((label) => label.name)).toEqual(['frontend', 'FROZEN']);
    // A wildcard in what the person typed is a character, not a pattern.
    const literal = await work.services.labels.list(member, 'CAT', { limit: 50, q: '50%' });
    expect(literal.items.map((label) => label.name)).toEqual(['50%_off']);
    const none = await work.services.labels.list(member, 'CAT', { limit: 50, q: '%' });
    expect(none.items).toEqual([]);
  });

  it('refuses a duplicate name and keeps configuration for project admins', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const member = work.as(work.users.member);
    await expect(
      work.services.labels.create(member, 'CAT', { name: 'DOCS' }),
    ).rejects.toBeInstanceOf(ConflictError);
    const [docs] = (await work.services.labels.list(member, 'CAT', { limit: 50, q: 'docs' })).items;
    if (!docs) throw new Error('The docs label is missing');
    await expect(
      work.services.labels.update(member, 'CAT', docs.id, { name: 'documentation' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      work.services.labels.list(work.as(work.users.outsider), 'CAT', { limit: 50 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const admin = work.as(work.users.admin);
    const renamed = await work.services.labels.update(admin, 'CAT', docs.id, {
      name: 'documentation',
      color: '#2456c9',
    });
    expect(renamed).toMatchObject({ name: 'documentation', color: '#2456c9' });
    const issue = await work.issue(project, 'Labelled', { labelIds: [docs.id] });
    await work.services.labels.remove(admin, 'CAT', docs.id);
    expect((await work.services.issues.get(admin, issue.key)).labelIds).toEqual([]);
    await expect(work.services.labels.remove(admin, 'CAT', docs.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('stamps a version when it is released and clears the stamp when it is reopened', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const admin = work.as(work.users.admin);
    const version = await work.services.versions.create(admin, 'CAT', {
      name: '1.0',
      releaseAt: '2026-11-02',
    });
    expect(version).toMatchObject({
      status: 'unreleased',
      releaseAt: '2026-11-02',
      releasedAt: null,
    });
    const released = await work.services.versions.update(admin, 'CAT', version.id, {
      status: 'released',
    });
    expect(released.releasedAt).not.toBeNull();
    const renamed = await work.services.versions.update(admin, 'CAT', version.id, {
      name: '1.0.0',
    });
    expect(renamed.releasedAt).toBe(released.releasedAt);
    const archived = await work.services.versions.update(admin, 'CAT', version.id, {
      status: 'archived',
    });
    expect(archived.releasedAt).toBe(released.releasedAt);
    const reopened = await work.services.versions.update(admin, 'CAT', version.id, {
      status: 'unreleased',
      releaseAt: null,
    });
    expect(reopened).toMatchObject({ status: 'unreleased', releasedAt: null, releaseAt: null });
    await work.services.versions.create(admin, 'CAT', { name: '2.0' });
    const unreleased = await work.services.versions.list(admin, 'CAT', {
      limit: 50,
      status: 'unreleased',
      q: '1',
    });
    expect(unreleased.items.map((item) => item.name)).toEqual(['1.0.0']);
    const audit = await work.sql<{ action: string }[]>`
      select action from audit_log where target_id = ${version.id} order by id`;
    expect(audit.map((row) => row.action)).toEqual([
      'version.created',
      'version.released',
      'version.updated',
      'version.archived',
      'version.unreleased',
    ]);
  });

  it('gives a component an active lead, and lets the lead go', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const admin = work.as(work.users.admin);
    const component = await work.services.components.create(admin, 'CAT', {
      name: 'Billing',
      leadUserId: work.users.member,
    });
    expect(component.leadUserId).toBe(work.users.member);
    await work.sql`update users set status = 'deactivated' where id = ${work.users.outsider}`;
    await expect(
      work.services.components.update(admin, 'CAT', component.id, {
        leadUserId: work.users.outsider,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await work.sql`update users set status = 'active' where id = ${work.users.outsider}`;
    const unled = await work.services.components.update(admin, 'CAT', component.id, {
      leadUserId: null,
      description: 'Invoices and payments',
    });
    expect(unled).toMatchObject({ leadUserId: null, description: 'Invoices and payments' });
    const listed = await work.services.components.list(admin, 'CAT', { limit: 50, q: 'bil' });
    expect(listed.items.map((item) => item.id)).toEqual([component.id]);
    await expect(
      work.services.components.update(admin, 'NOPE', component.id, { name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
