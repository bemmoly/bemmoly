import { ValidationError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpaceMember, SpaceMembersResponse } from '../../../../shared/members.ts';
import type { Space } from '../../../../shared/spaces.ts';
import { startDocsHttp, type DocsHttp } from '../../testing/http-support.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

/*
 * Space membership as a real install sees it: a space admin who is not an
 * org admin creates the space, so nothing but production code puts anyone in
 * it, then manages members over HTTP and asks them to review.
 */

async function seed(sql: DocsHarness['sql'], email: string, roleKey: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into users (email, name, role_id)
    select ${email}, ${email.split('@')[0] ?? email}, id from roles where key = ${roleKey}
    returning id`;
  if (!row) throw new Error(`The ${roleKey} role is not seeded`);
  return row.id;
}

describe('space members', () => {
  let harness: DocsHarness | null = null;
  let http: DocsHttp;
  let skipReason = '';
  let lead = '';
  let space: Space;
  let roles: Record<string, string> = {};

  beforeAll(async () => {
    const started = await startDocsHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    http = await startDocsHttp(harness);
    lead = await seed(harness.sql, 'lea@example.test', 'project_admin');
    space = await harness.services.spaces.create(harness.as(lead), { key: 'RFC', name: 'RFCs' });
    const rows = await harness.sql<{ id: string; key: string }[]>`select id, key from roles`;
    roles = Object.fromEntries(rows.map((row) => [row.key, row.id]));
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  const list = async (as: string) => {
    const response = await http.call('GET', `/spaces/RFC/members`, { as });
    expect(response.statusCode).toBe(200);
    return response.json<SpaceMembersResponse>();
  };

  it('makes the creator a space admin and lists org admins as able to review', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { items, roles: offered, canManage } = await list(lead);
    expect(canManage).toBe(true);
    expect(offered.map((role) => role.key)).toContain('project_admin');
    const byId = new Map(items.map((item) => [item.userId, item]));
    expect(byId.get(lead)).toMatchObject({
      access: 'member',
      roleKey: 'project_admin',
      canReview: true,
    });
    expect(byId.get(harness.users.admin)).toMatchObject({
      access: 'org_admin',
      canReview: true,
      addedAt: null,
    });
    expect(byId.has(harness.users.member)).toBe(false);
  });

  it('adds, changes and removes members, and refuses people who may not', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { users } = harness;
    const put = (as: string, userId: string, roleId: string | undefined) =>
      http.call('PUT', `/spaces/RFC/members/${userId}`, { as, body: { roleId } });

    expect((await put(users.member, users.member, roles.member)).statusCode).toBe(403);
    const added = await put(lead, users.member, roles.member);
    expect(added.statusCode).toBe(200);
    expect(added.json<SpaceMember>()).toMatchObject({ roleKey: 'member', canReview: true });

    expect((await list(users.member)).canManage).toBe(false);
    expect((await http.call('GET', '/spaces/RFC/members', { as: users.outsider })).statusCode).toBe(
      403,
    );
    expect((await http.call('GET', '/spaces/RFC/members', { as: null })).statusCode).toBe(401);
    expect((await put(lead, users.member, undefined)).statusCode).toBe(400);

    const bulk = await http.call('POST', '/spaces/RFC/members', {
      as: lead,
      body: { userIds: [users.viewer], roleId: roles.viewer },
    });
    expect(bulk.statusCode).toBe(201);
    expect(bulk.json<{ items: SpaceMember[] }>().items).toMatchObject([
      { userId: users.viewer, roleKey: 'viewer', canReview: true },
    ]);
    const denied = await http.call('POST', '/spaces/RFC/members', {
      as: users.member,
      body: { userIds: [users.outsider] },
    });
    expect(denied.statusCode).toBe(403);

    const promoted = await put(lead, users.viewer, roles.member);
    expect(promoted.json<SpaceMember>().roleKey).toBe('member');
    const removeViewer = `/spaces/RFC/members/${users.viewer}`;
    expect((await http.call('DELETE', removeViewer, { as: users.member })).statusCode).toBe(403);
    expect((await http.call('DELETE', removeViewer, { as: lead })).statusCode).toBe(204);
    expect((await http.call('DELETE', removeViewer, { as: lead })).statusCode).toBe(404);

    const leaveAlone = await http.call('DELETE', `/spaces/RFC/members/${lead}`, { as: lead });
    expect(leaveAlone.statusCode).toBe(409);
    expect((await put(lead, lead, roles.member)).statusCode).toBe(409);
    expect(await harness.auditActions()).toEqual(
      expect.arrayContaining([
        'space.members.added',
        'space.members.role_changed',
        'space.members.removed',
      ]),
    );
    expect(harness.realtime).toContainEqual(
      expect.objectContaining({ kind: 'docs.space', userId: users.viewer }),
    );
  });

  it('lets the creator ask a member to review, and still refuses a non-member', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const page = await services.pages.create(as(lead), { spaceId: space.id, title: 'Cache RFC' });
    await expect(
      services.status.setReviewers(as(lead), page.id, { reviewers: [users.outsider] }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      services.status.setReviewers(as(lead), page.id, { reviewers: [users.viewer] }),
    ).rejects.toBeInstanceOf(ValidationError);
    const reviewed = await services.status.setReviewers(as(lead), page.id, {
      reviewers: [users.member, users.admin],
    });
    expect([...reviewed.reviewers].sort()).toEqual([users.member, users.admin].sort());
    const inReview = await services.status.setStatus(as(lead), page.id, { status: 'in_review' });
    expect(inReview.status).toBe('in_review');
  });

  it('adds a team space’s people at create and when the space changes team', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users, sql } = harness;
    const team = async (name: string, member: string) => {
      const [row] = await sql<{ id: string }[]>`
        insert into teams (name) values (${name}) returning id`;
      await sql`insert into team_members (team_id, user_id) values (${row!.id}, ${member})`;
      return row!.id;
    };
    const platform = await team('Platform', users.member);
    const design = await team('Design', users.viewer);
    const teamSpace = await services.spaces.create(as(lead), {
      key: 'PLAT',
      name: 'Platform',
      teamId: platform,
    });
    const people = async () =>
      (await services.members.list(as(lead), 'PLAT')).items
        .filter((item) => item.access === 'member')
        .map((item) => item.userId)
        .sort();
    expect(await people()).toEqual([lead, users.member].sort());
    await services.spaces.update(as(lead), teamSpace.key, { teamId: design });
    expect(await people()).toEqual([lead, users.member, users.viewer].sort());
  });
});
