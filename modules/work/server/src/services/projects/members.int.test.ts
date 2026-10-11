import { ConflictError, ForbiddenError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Issue } from '../../../../shared/issues.ts';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

describe('project members against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let project: Project;
  let issue: Issue;
  const roles: Record<string, string> = {};

  const roleOf = async (key: string, userId: string) =>
    (await work.services.members.list(work.as(work.users.admin), key)).items.find(
      (member) => member.userId === userId,
    )?.roleKey;

  const lqlKeys = async (userId: string) =>
    (await work.services.lql.query(work.as(userId), { lql: '', limit: 50 })).items.map(
      (row) => row.key,
    );

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    for (const row of await work.sql<{ id: string; key: string }[]>`select id, key from roles`) {
      roles[row.key] = row.id;
    }
    project = await work.project('MEMB');
    issue = await work.issue(project, 'Rotate the signing keys');
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('makes the creator the project admin and the owning team members', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const [team] = await work.sql<{ id: string }[]>`
      insert into teams (name, default_role_id) values ('Platform', ${roles['viewer']!})
      returning id`;
    for (const userId of [work.users.admin, work.users.outsider]) {
      await work.sql`insert into team_members (team_id, user_id) values (${team!.id}, ${userId})`;
    }
    const owned = await work.services.projects.create(work.as(work.users.admin), {
      key: 'OWND',
      name: 'Owned',
      teamId: team!.id,
    });
    expect(await roleOf(owned.key, work.users.admin)).toBe('project_admin');
    expect(await roleOf(owned.key, work.users.outsider)).toBe('viewer');
    expect(await roleOf(owned.key, work.users.member)).toBeUndefined();
  });

  it('adds a person who then sees the project, its issues and search hits', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const member = work.users.member;
    await expect(work.services.issues.get(work.as(member), issue.key)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    work.realtime.length = 0;
    const added = await work.services.members.add(work.as(work.users.admin), project.key, {
      userIds: [member],
    });
    expect(added.items.map((row) => [row.userId, row.roleKey])).toEqual([[member, 'member']]);
    expect((await work.services.issues.get(work.as(member), issue.key)).key).toBe(issue.key);
    const hits = await work.services.search.search(work.as(member), { q: 'signing', limit: 5 });
    expect(hits.map((hit) => hit.key)).toEqual([issue.key]);
    expect(await lqlKeys(member)).toEqual([issue.key]);
    expect(await lqlKeys(work.users.admin)).toContain(issue.key);
    const listed = await work.services.projects.list(work.as(member), {
      limit: 50,
      archived: false,
    });
    expect(listed.items.map((row) => row.key)).toContain(project.key);
    await work.sql`update issues set assignee_id = ${member} where id = ${issue.id}`;
    const mine = await work.services.myWork.list(work.as(member), { limit: 6 });
    expect(mine.assigned.items.map((row) => row.key)).toEqual([issue.key]);
    expect(await work.services.boards.listForProject(work.as(member), project.key)).toHaveLength(1);
    expect(work.realtime).toContainEqual({
      kind: 'work.members',
      ids: [member],
      projectId: project.id,
    });
    expect(work.realtime).toContainEqual({
      kind: 'work.members',
      ids: [project.id],
      userId: member,
    });
    const [audit] = await work.sql<{ action: string }[]>`
      select action from audit_log where target_id = ${project.id}
        and action like 'project.members.%' order by created_at desc limit 1`;
    expect(audit?.action).toBe('project.members.added');
  });

  it('lets only someone who configures the project change members', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    await expect(
      work.services.members.add(work.as(work.users.member), project.key, {
        userIds: [work.users.outsider],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      work.services.members.list(work.as(work.users.outsider), project.key),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('changes a role, which changes what the person may do there', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const member = work.users.member;
    const promoted = await work.services.members.setRole(
      work.as(work.users.admin),
      project.key,
      member,
      roles['project_admin']!,
    );
    expect(promoted.roleKey).toBe('project_admin');
    const asMember = await work.services.members.list(work.as(member), project.id);
    expect(asMember.canManage).toBe(true);
    await work.services.members.setRole(work.as(member), project.key, member, roles['member']!);
    expect((await work.services.members.list(work.as(member), project.key)).canManage).toBe(false);
  });

  it('refuses to remove or demote the last project admin', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const admin = work.as(work.users.admin);
    await expect(
      work.services.members.remove(admin, project.key, work.users.admin),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      work.services.members.setRole(admin, project.key, work.users.admin, roles['member']!),
    ).rejects.toThrow('at least one project admin');
    expect(await roleOf(project.key, work.users.admin)).toBe('project_admin');
  });

  it('revokes access to issues, search and the project list at once on removal', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const member = work.users.member;
    await work.services.members.remove(work.as(work.users.admin), project.key, member);
    await expect(work.services.issues.get(work.as(member), issue.key)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await work.services.search.search(work.as(member), { q: 'signing', limit: 5 })).toEqual(
      [],
    );
    const listed = await work.services.projects.list(work.as(member), {
      limit: 50,
      archived: false,
    });
    expect(listed.items.map((row) => row.key)).not.toContain(project.key);
    const mine = await work.services.myWork.list(work.as(member), { limit: 6 });
    expect(mine.assigned.items).toEqual([]);
    expect(await lqlKeys(member)).toEqual([]);
    await expect(
      work.services.boards.listForProject(work.as(member), project.key),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
