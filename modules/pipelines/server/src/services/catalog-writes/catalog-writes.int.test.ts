import type { RequestContext } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applicationWriteResultSchema } from '../../../../shared/catalog-writes.ts';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';
import type { PullRequestInput } from '../code/pull-requests.ts';
import { createCatalogWritesService } from './index.ts';

describe('catalog writes and application.yaml sync', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let reason = '';
  let system: RequestContext;

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    await seedCatalogFixture(harness.sql, harness.users.member);
    http = await startPipelinesHttp(harness);
    system = {
      ...harness.as(harness.users.admin),
      actor: { kind: 'system', id: 'code-host:test' },
    };
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  const admin = () => harness?.users.admin ?? '';
  const member = () => harness?.users.member ?? '';

  it('lets a Platform admin shape domains and groups, and nobody else', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const domain = await http.send('POST', '/domains', admin(), {
      key: 'growth',
      name: 'Growth',
      color: 'epic-4',
    });
    expect(domain.statusCode).toBe(201);
    expect(domain.json()).toMatchObject({ key: 'growth', groupCount: 0 });
    expect(
      (await http.send('POST', '/domains', admin(), { key: 'growth', name: 'Again' })).statusCode,
    ).toBe(409);
    expect(
      (await http.send('POST', '/domains', member(), { key: 'ops', name: 'Ops' })).statusCode,
    ).toBe(403);
    const group = await http.send('POST', '/groups', admin(), {
      domain: 'growth',
      key: 'referrals',
      name: 'Referrals',
    });
    expect(group.statusCode).toBe(201);
    expect((await http.send('DELETE', '/domains/growth', admin())).statusCode).toBe(409);
    expect(
      (await http.send('POST', '/groups', member(), { domain: 'commerce', key: 'x', name: 'X' }))
        .statusCode,
    ).toBe(403);
    expect((await http.send('DELETE', `/groups/${group.json().id}`, admin())).statusCode).toBe(204);
  });

  it('lets the owning team change its application at once', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await http.send('PATCH', '/applications/checkout-api', member(), {
      tier: 1,
      labels: ['node'],
    });
    expect(response.statusCode).toBe(200);
    const result = applicationWriteResultSchema.parse(response.json());
    expect(result).toMatchObject({
      source: 'ui',
      change: null,
      application: { tier: 1, labels: ['node'] },
    });
    expect(
      (await http.send('PATCH', '/applications/pricing-svc', member(), { tier: 0 })).statusCode,
    ).toBe(403);
    expect(
      (await http.send('PATCH', '/applications/checkout-api', member(), { owner: 'team/nobody' }))
        .statusCode,
    ).toBe(400);
  });

  it('checks dependencies name real applications', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const bad = await http.send('PUT', '/applications/checkout-api/dependencies', member(), {
      dependsOn: ['nope'],
    });
    expect(bad.statusCode).toBe(400);
    const good = await http.send('PUT', '/applications/checkout-api/dependencies', member(), {
      dependsOn: ['pricing-svc'],
    });
    expect(good.statusCode).toBe(200);
  });

  it('creates an application and asks for its application.yaml, waiting when it cannot', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await http.send('POST', '/applications', admin(), {
      key: 'refunds',
      name: 'Refunds',
      group: 'commerce/checkout',
      owner: 'team/payments',
      tier: 1,
      repository: { fullName: 'acme/refunds' },
    });
    expect(response.statusCode).toBe(201);
    const result = applicationWriteResultSchema.parse(response.json());
    expect(result.application.ownerTeam?.name).toBe('Payments');
    expect(result.change).toMatchObject({
      kind: 'create',
      state: 'pending',
      reason: expect.stringContaining('not connected'),
    });
    const pending = await http.get('/catalog-changes', member(), { state: 'pending' });
    expect(pending.json().items).toHaveLength(1);
  });

  it('syncs application.yaml from a push, then routes UI edits through a pull request', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const writes = harness.services.catalogWrites;
    const file =
      'name: lake-ingest\ngroup: lake\nowner: team/payments\ntier: 1\ndependsOn: [lake-batch]\n';
    const batch = 'name: lake-batch\ngroup: lake\nowner: team/ghosts\n';
    const result = await writes.applyApplicationFiles(system, {
      repository: { fullName: 'acme/data', defaultBranch: 'main' },
      commitSha: 'abc1234',
      files: [
        { path: 'ingest/.bemmoly/application.yaml', content: file },
        { path: 'batch/.bemmoly/application.yaml', content: batch },
        { path: 'broken/.bemmoly/application.yaml', content: 'name: Broken\n' },
        { path: 'README.md', content: '# hi' },
      ],
    });
    expect(result.applied.sort()).toEqual(['lake-batch', 'lake-ingest']);
    expect(result.problems).toEqual([
      expect.objectContaining({ path: 'batch/.bemmoly/application.yaml', applied: true }),
      expect.objectContaining({ path: 'broken/.bemmoly/application.yaml', applied: false }),
    ]);
    const [row] = await harness.sql<{ source: string; tier: number; path: string }[]>`
      select source, tier, path from pipeline_applications where key = 'lake-ingest'`;
    expect(row).toEqual({ source: 'repository', tier: 1, path: 'ingest' });

    const opened: PullRequestInput[] = [];
    const withHost = createCatalogWritesService({
      database: harness.sql,
      access: harness.services.access,
      repositories: {
        tree: async () => ({
          commitSha: 'abc1234',
          paths: [],
          read: async () => `# keep me\n${file}`,
        }),
      },
      pullRequests: {
        openPullRequest: async (input) => {
          opened.push(input);
          return { url: 'https://github.com/acme/data/pull/7' };
        },
      },
    });
    const edit = await withHost.applications.update(harness.as(member()), 'lake-ingest', {
      tier: 0,
      name: 'Lake ingest',
    });
    expect(edit.change).toMatchObject({
      state: 'pull_request',
      pullRequestUrl: 'https://github.com/acme/data/pull/7',
    });
    expect(edit.application).toMatchObject({ tier: 1, name: 'Lake ingest' });
    expect(opened[0]?.files[0]?.content).toContain('# keep me');
    expect(opened[0]?.files[0]?.content).toContain('tier: 0');

    // The pull request merges: the next push applies it and closes the change.
    await writes.applyApplicationFiles(system, {
      repository: { fullName: 'acme/data' },
      commitSha: 'def5678',
      files: [
        { path: 'ingest/.bemmoly/application.yaml', content: opened[0]?.files[0]?.content ?? '' },
      ],
    });
    const changes = await http.get('/catalog-changes', member(), { application: 'lake-ingest' });
    expect(changes.json().items[0]).toMatchObject({ state: 'applied' });

    const removed = await writes.applyApplicationFiles(system, {
      repository: { fullName: 'acme/data' },
      commitSha: 'fed9876',
      files: [{ path: 'batch/.bemmoly/application.yaml', content: null }],
    });
    expect(removed.archived).toEqual(['lake-batch']);
  });

  it('deletes an application without history and archives one with it', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    expect((await http.send('DELETE', '/applications/gift-cards', admin())).statusCode).toBe(204);
    expect((await http.get('/applications/gift-cards', member())).statusCode).toBe(404);
    expect((await http.send('DELETE', '/applications/checkout-api', member())).statusCode).toBe(
      204,
    );
    const [row] = await harness.sql<{ archived: boolean }[]>`
      select archived_at is not null as archived from pipeline_applications where key = 'checkout-api'`;
    expect(row?.archived).toBe(true);
  });
});
