import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BOOT_ORIGIN, startBootHarness, type BootHarness } from './boot-harness.ts';

/*
 * Docs and Work in one host, neither importing the other: an issue embedded
 * in a page resolves through the kernel's entity registry, follows the
 * reader's issue permissions, links the page both ways, and quietly drops
 * out when Work is disabled.
 */

const embedOf = (key: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'issueEmbed', attrs: { key } }] }],
});

describe('docs with work', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startBootHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });

  afterAll(async () => harness?.stop());

  it('resolves issue embeds for people who may view the issue, both ways', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.boot();
    const call = async (method: string, url: string, payload?: unknown, cookie?: string) => {
      const response = await app.inject({
        method: method as 'GET',
        url: `/api/v1${url}`,
        ...(payload !== undefined ? { payload: payload as object } : {}),
        ...(cookie ? { headers: { cookie } } : {}),
      });
      if (response.statusCode >= 400) throw new Error(`${method} ${url}: ${response.body}`);
      return response.statusCode === 204 ? null : response.json();
    };
    for (const id of ['work', 'docs']) {
      await call('POST', `/admin/modules/${id}/enable`, { access: { mode: 'everyone' } });
    }
    const roles = (await call('GET', '/roles')).items as { id: string; key: string }[];
    const memberRole = roles.find((role) => role.key === 'member')!.id;
    const invited = await call('POST', '/invitations', {
      emails: ['sam@acmelabs.dev'],
      roleId: memberRole,
    });
    const token = /token=([\w-]+)/.exec(invited.items[0].acceptUrl as string)![1];
    const accepted = await app.instance.app.inject({
      method: 'POST',
      url: `/api/v1/auth/invitations/${token}/accept`,
      headers: { origin: BOOT_ORIGIN },
      payload: { name: 'Sam R.', password: 'twelve chars ok' },
    });
    const setCookie = accepted.headers['set-cookie'];
    const sam = (Array.isArray(setCookie) ? setCookie : [setCookie ?? ''])
      .map((value) => value.split(';')[0])
      .join('; ');
    const samId = accepted.json().user.id as string;

    const project = await call('POST', '/work/projects', { key: 'PLT', name: 'Platform' });
    const types = (await call('GET', '/work/projects/PLT/issue-types')).items as {
      id: string;
      key: string;
    }[];
    const task = types.find((type) => type.key === 'task')!;
    const issue = await call('POST', '/work/issues', {
      projectId: project.id,
      typeId: task.id,
      title: 'Warm the cache',
    });
    expect(issue.key).toBe('PLT-1');

    const space = await call('POST', '/docs/spaces', { key: 'ENG', name: 'Engineering' });
    await call('PUT', `/docs/spaces/ENG/members/${samId}`, { roleId: memberRole });
    const page = await call('POST', '/docs/pages', {
      spaceId: space.id,
      title: 'Cache plan',
      snapshot: embedOf('PLT-1'),
    });
    const sql = app.instance.database!.sql;
    const edges = await sql<{ target_id: string; kind: string }[]>`
      select target_id, kind from links where source_id = ${page.id}`;
    expect(edges).toEqual([{ target_id: issue.id, kind: 'embed' }]);

    const links = (cookie?: string) =>
      call('GET', `/docs/pages/${page.id}/links`, undefined, cookie);
    const recentKeys = async (cookie?: string) =>
      (
        (await call('GET', '/docs/home/recent', undefined, cookie)).items as {
          id: string;
          issueKeys: string[];
        }[]
      ).find((row) => row.id === page.id)?.issueKeys;
    expect((await links()).items).toMatchObject([
      { kind: 'embed', record: { kind: 'issue', key: 'PLT-1', title: 'Warm the cache' } },
    ]);
    expect(await recentKeys()).toEqual(['PLT-1']);

    expect((await links(sam)).items).toEqual([]);
    expect(await recentKeys(sam)).toEqual([]);
    await call('POST', '/work/projects/PLT/members', { userIds: [samId] });
    expect((await links(sam)).items).toMatchObject([{ record: { key: 'PLT-1' } }]);
    expect(await recentKeys(sam)).toEqual(['PLT-1']);
    const linkedDocs = await call('GET', '/docs/references?kind=issue&key=PLT-1', undefined, sam);
    expect(linkedDocs.items).toMatchObject([{ pageId: page.id }]);

    await call('POST', '/work/issues', {
      projectId: project.id,
      typeId: task.id,
      title: 'Follow the plan',
      description: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'pageLink', attrs: { pageId: page.id, title: 'Cache plan' } }],
          },
        ],
      },
    });
    const referencedIn = await call('GET', `/docs/pages/${page.id}/references`, undefined, sam);
    expect(referencedIn.items).toMatchObject([
      { kind: 'issue', key: 'PLT-2', linkKind: 'mention' },
    ]);

    await call('POST', '/admin/modules/work/disable');
    expect((await links()).items).toEqual([]);
    expect(await recentKeys()).toEqual([]);
    expect((await call('GET', `/docs/pages/${page.id}/references`)).items).toEqual([]);
    expect(await call('GET', `/docs/pages/${page.id}`)).toMatchObject({ title: 'Cache plan' });
  });
});
