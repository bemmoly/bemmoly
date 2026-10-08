import { tokenOfLink } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BOOT_ORIGIN, startBootHarness, type BootHarness } from './boot-harness.ts';

type Item = { id: string; email: string; roleId: string; status?: string };

describe('inviting someone on an install without outbound email', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startBootHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });

  afterAll(async () => harness?.stop());

  it('keeps the invitation, hands the admin a link, and lets the person join as Viewer', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.boot();
    const sql = app.instance.database?.sql;
    if (!sql) throw new Error('no database');
    const roles = (await app.inject({ url: '/api/v1/roles' })).json().items as {
      id: string;
      key: string;
    }[];
    const viewer = roles.find((role) => role.key === 'viewer')?.id;

    const invited = await app.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      payload: { emails: ['sam@acmelabs.dev'] },
    });
    expect(invited.statusCode).toBe(201);
    const body = invited.json() as {
      items: (Item & { acceptUrl: string })[];
      emailConfigured: boolean;
    };
    expect(body.emailConfigured).toBe(false);
    const [first] = body.items;
    expect(first).toMatchObject({ email: 'sam@acmelabs.dev', roleId: viewer });
    expect(first?.acceptUrl).toMatch(
      /^http:\/\/localhost:8080\/accept-invitation#token=[\w-]{43}$/,
    );
    const [queued] = await sql<{ count: number }[]>`
      select count(*)::int as count from email_outbox where to_address = 'sam@acmelabs.dev'`;
    expect(queued?.count).toBe(1);

    const pending = (await app.inject({ url: '/api/v1/invitations' })).json().items as Item[];
    expect(pending.map((item) => item.email)).toEqual(['sam@acmelabs.dev']);
    const before = (await app.inject({ url: '/api/v1/users' })).json().items as Item[];
    expect(before.map((user) => user.email)).toEqual(['rohan@acmelabs.dev']);

    const reissued = await app.inject({
      method: 'POST',
      url: `/api/v1/invitations/${first?.id}/links`,
    });
    expect(reissued.statusCode).toBe(201);
    const link = reissued.json().acceptUrl as string;
    expect(link).not.toBe(first?.acceptUrl);
    // The invitee's browser: same origin, no session.
    const anonymous = (url: string, payload?: Record<string, unknown>) =>
      app.instance.app.inject({
        url,
        method: payload ? 'POST' : 'GET',
        headers: { origin: BOOT_ORIGIN },
        ...(payload ? { payload } : {}),
      });
    const stale = await anonymous(`/api/v1/auth/invitations/${tokenOfLink(first!.acceptUrl)}`);
    expect(stale.statusCode).toBe(404);
    const token = tokenOfLink(link);
    const preview = await anonymous(`/api/v1/auth/invitations/${token}`);
    expect(preview.json()).toMatchObject({
      email: 'sam@acmelabs.dev',
      workspaceName: 'Acme Labs',
      inviterName: 'Rohan S.',
      roleName: 'Viewer',
    });

    const accepted = await anonymous(`/api/v1/auth/invitations/${token}/accept`, {
      name: 'Sam R.',
      password: 'twelve chars ok',
    });
    expect(accepted.statusCode).toBe(201);
    const users = (await app.inject({ url: '/api/v1/users' })).json().items as Item[];
    expect(users.find((user) => user.email === 'sam@acmelabs.dev')).toMatchObject({
      status: 'active',
      roleId: viewer,
    });
    expect((await app.inject({ url: '/api/v1/invitations' })).json().items).toEqual([]);

    const audit = await sql<{ action: string }[]>`
      select action from audit_log where target_kind = 'invitation' order by id`;
    expect(audit.map((row) => row.action)).toEqual([
      'invitation.created',
      'invitation.link_issued',
      'invitation.accepted',
    ]);
  });
});
