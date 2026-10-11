import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Space } from '../../../../shared/spaces.ts';
import type { OrgTemplate, TemplateDetail, TemplateSummary } from '../../../../shared/templates.ts';
import { startDocsHttp, type DocsHttp } from '../../testing/http-support.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

/*
 * Settings › Docs over HTTP against real Postgres: only those who manage org templates (org
 * admins by default, not project admins) list, add, change, order, archive, restore and
 * duplicate org-wide templates; built-ins read only; an archived template leaves the picker
 * and cannot make a page until it is restored.
 */

const SNAPSHOT = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Context' }] }],
};

describe('org templates', () => {
  let harness: DocsHarness | null = null;
  let http: DocsHttp;
  let skipReason = '';
  let lead = '';
  let space: Space;

  beforeAll(async () => {
    const started = await startDocsHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    http = await startDocsHttp(harness);
    const [row] = await harness.sql<{ id: string }[]>`
      insert into users (email, name, role_id)
      select 'lea@example.test', 'lea', id from roles where key = 'project_admin'
      returning id`;
    lead = row!.id;
    space = await harness.space('TPL');
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  const users = () => harness!.users;
  const orgList = async (as: string) => {
    const response = await http.call('GET', '/org-templates', { as });
    return {
      status: response.statusCode,
      items: (response.json() as { items?: OrgTemplate[] }).items,
    };
  };
  const picker = async (as: string) =>
    (
      (await http.call('GET', `/templates?spaceId=${space.id}`, { as })).json() as {
        items: TemplateSummary[];
      }
    ).items;
  const create = async (as: string, name: string) =>
    http.call('POST', '/templates', {
      as,
      body: {
        spaceId: null,
        name,
        description: 'Why we decided',
        category: 'Engineering',
        icon: 'compass',
        snapshot: SNAPSHOT,
        fields: [{ key: 'status', label: 'Status', kind: 'select', options: ['Open', 'Done'] }],
      },
    });
  const builtin = async (key: string) => {
    const [row] = await harness!.sql<{ id: string }[]>`select id from templates where key = ${key}`;
    return row!.id;
  };

  it('lists the org templates with their use and maker only for org admins', async (context) => {
    if (!harness) return context.skip(skipReason);
    const admin = await orgList(users().admin);
    expect(admin.status).toBe(200);
    expect(admin.items?.map((item) => item.key)).toEqual([
      'rfc',
      'meeting-notes',
      'postmortem',
      'product-spec',
      'runbook',
      'decision-log',
    ]);
    expect(admin.items?.every((item) => item.isBuiltin && item.archivedAt === null)).toBe(true);
    expect(admin.items?.[0]).toMatchObject({ usedBy: 0, createdBy: null });
    expect((await orgList(users().member)).status).toBe(403);
    expect((await orgList(lead)).status).toBe(403);
    expect((await http.call('GET', '/org-templates', { as: null })).statusCode).not.toBe(200);
  });

  it('adds an org template for an admin, refuses members, and shows it in every picker', async (context) => {
    if (!harness) return context.skip(skipReason);
    expect((await create(users().member, 'ADR')).statusCode).toBe(403);
    expect((await create(lead, 'ADR')).statusCode).toBe(403);
    const created = await create(users().admin, 'ADR');
    expect(created.statusCode).toBe(201);
    const adr = created.json() as TemplateDetail;
    expect(adr).toMatchObject({ spaceId: null, isBuiltin: false, position: 6, icon: 'compass' });
    expect((await picker(users().member)).at(-1)?.name).toBe('ADR');

    const page = await http.call('POST', `/templates/${adr.id}/pages`, {
      as: users().member,
      body: { spaceId: space.id },
    });
    expect(page.statusCode).toBe(201);
    const listed = (await orgList(users().admin)).items?.find((item) => item.id === adr.id);
    expect(listed).toMatchObject({ usedBy: 1, createdBy: { id: users().admin, name: 'ada' } });
  });

  it('edits an org template for admins only and keeps built-ins read only', async (context) => {
    if (!harness) return context.skip(skipReason);
    const adr = (await orgList(users().admin)).items!.find((item) => item.name === 'ADR')!;
    const patch = { name: 'Architecture decision' };
    expect(
      (await http.call('PATCH', `/templates/${adr.id}`, { as: users().member, body: patch }))
        .statusCode,
    ).toBe(403);
    const edited = await http.call('PATCH', `/templates/${adr.id}`, {
      as: users().admin,
      body: patch,
    });
    expect(edited.statusCode).toBe(200);
    expect((edited.json() as TemplateDetail).name).toBe('Architecture decision');

    const rfc = await builtin('rfc');
    const refused = await http.call('PATCH', `/templates/${rfc}`, {
      as: users().admin,
      body: { name: 'Mine now' },
    });
    expect(refused.statusCode).toBe(409);
    expect((await http.call('DELETE', `/templates/${rfc}`, { as: users().admin })).statusCode).toBe(
      409,
    );
  });

  it('archives and restores, hiding an archived template from pickers and new pages', async (context) => {
    if (!harness) return context.skip(skipReason);
    const adr = (await orgList(users().admin)).items!.find((item) => !item.isBuiltin)!;
    const archive = (as: string) => http.call('POST', `/templates/${adr.id}/archive`, { as });
    const restore = (as: string) => http.call('POST', `/templates/${adr.id}/restore`, { as });

    expect((await archive(users().member)).statusCode).toBe(403);
    const archived = await archive(users().admin);
    expect(archived.statusCode).toBe(200);
    expect((archived.json() as OrgTemplate).archivedAt).not.toBeNull();
    expect((await archive(users().admin)).statusCode).toBe(409);
    expect((await picker(users().member)).some((item) => item.id === adr.id)).toBe(false);
    const fromArchived = await http.call('POST', `/templates/${adr.id}/pages`, {
      as: users().member,
      body: { spaceId: space.id },
    });
    expect(fromArchived.statusCode).toBe(404);
    expect((await orgList(users().admin)).items?.at(-1)?.id).toBe(adr.id);

    expect((await restore(users().member)).statusCode).toBe(403);
    const restored = await restore(users().admin);
    expect(restored.statusCode).toBe(200);
    expect((restored.json() as OrgTemplate).archivedAt).toBeNull();
    expect((await picker(users().member)).some((item) => item.id === adr.id)).toBe(true);
    expect(await harness.auditActions()).toEqual(
      expect.arrayContaining(['template.archived', 'template.restored']),
    );
  });

  it('archives a built-in, hiding it, and restores it', async (context) => {
    if (!harness) return context.skip(skipReason);
    const log = await builtin('decision-log');
    expect(
      (await http.call('POST', `/templates/${log}/archive`, { as: users().admin })).statusCode,
    ).toBe(200);
    expect((await picker(users().member)).some((item) => item.id === log)).toBe(false);
    expect(
      (await http.call('POST', `/templates/${log}/restore`, { as: users().admin })).statusCode,
    ).toBe(200);
    expect((await picker(users().member)).some((item) => item.id === log)).toBe(true);
  });

  it('duplicates a built-in into an editable copy placed after it', async (context) => {
    if (!harness) return context.skip(skipReason);
    const spec = await builtin('product-spec');
    expect(
      (await http.call('POST', `/templates/${spec}/duplicate`, { as: users().member })).statusCode,
    ).toBe(403);
    const response = await http.call('POST', `/templates/${spec}/duplicate`, {
      as: users().admin,
    });
    expect(response.statusCode).toBe(201);
    const copy = response.json() as TemplateDetail;
    expect(copy).toMatchObject({ isBuiltin: false, key: null, spaceId: null });
    expect(copy.name).toMatch(/ \(copy\)$/);
    const names = (await picker(users().member)).map((item) => item.id);
    expect(names.indexOf(copy.id)).toBe(names.indexOf(spec) + 1);
    const edited = await http.call('PATCH', `/templates/${copy.id}`, {
      as: users().admin,
      body: { name: 'Our spec' },
    });
    expect(edited.statusCode).toBe(200);
  });

  it('reorders the active org templates for admins and refuses a stale order', async (context) => {
    if (!harness) return context.skip(skipReason);
    const active = (await orgList(users().admin)).items!.filter((item) => !item.archivedAt);
    const reversed = active.map((item) => item.id).toReversed();
    expect(
      (
        await http.call('PUT', '/org-templates/order', {
          as: users().member,
          body: { ids: reversed },
        })
      ).statusCode,
    ).toBe(403);
    const done = await http.call('PUT', '/org-templates/order', {
      as: users().admin,
      body: { ids: reversed },
    });
    expect(done.statusCode).toBe(204);
    expect((await picker(users().member)).map((item) => item.id)).toEqual(reversed);

    const stale = await http.call('PUT', '/org-templates/order', {
      as: users().admin,
      body: { ids: reversed.slice(1) },
    });
    expect(stale.statusCode).toBe(409);
    const twice = await http.call('PUT', '/org-templates/order', {
      as: users().admin,
      body: { ids: [...reversed.slice(1), reversed[1]] },
    });
    expect(twice.statusCode).toBe(400);
  });

  it('leaves a space template to its configurers and out of the org list', async (context) => {
    if (!harness) return context.skip(skipReason);
    const response = await http.call('POST', '/templates', {
      as: users().admin,
      body: { spaceId: space.id, name: 'Team retro', snapshot: SNAPSHOT },
    });
    expect(response.statusCode).toBe(201);
    const retro = response.json() as TemplateDetail;
    expect((await orgList(users().admin)).items?.some((item) => item.id === retro.id)).toBe(false);
    expect(
      (await http.call('POST', `/templates/${retro.id}/archive`, { as: users().member }))
        .statusCode,
    ).toBe(403);
    expect(
      (await http.call('POST', `/templates/${retro.id}/archive`, { as: users().admin })).statusCode,
    ).toBe(200);
  });
});
