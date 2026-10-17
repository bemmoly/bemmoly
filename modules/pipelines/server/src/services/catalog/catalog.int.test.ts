import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applicationsPageSchema, applicationFacetsSchema } from '../../../../shared/catalog.ts';
import { seedCatalogFixture, type CatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';

describe('catalog endpoints', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let fixture: CatalogFixture;
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    fixture = await seedCatalogFixture(harness.sql, harness.users.member);
    http = await startPipelinesHttp(harness);
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  const member = () => harness?.users.member ?? '';

  it('lists domains with their group and application counts', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await http.get('/domains', member());
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual([
      expect.objectContaining({ key: 'commerce', groupCount: 2, applicationCount: 4 }),
      expect.objectContaining({ key: 'data', groupCount: 1, applicationCount: 1 }),
    ]);
  });

  it('pages groups by name and filters them by domain', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const first = await http.get('/groups', member(), { domain: 'commerce', limit: '1' });
    const page = first.json();
    expect(page.items.map((group: { key: string }) => group.key)).toEqual(['checkout']);
    const second = await http.get('/groups', member(), {
      domain: 'commerce',
      limit: '1',
      cursor: page.nextCursor,
    });
    expect(second.json().items.map((group: { key: string }) => group.key)).toEqual(['pricing']);
    expect(second.json().nextCursor).toBeNull();
  });

  it('lists applications in name order with delivery numbers, then the next page', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await http.get('/applications', member(), { limit: '2' });
    const page = applicationsPageSchema.parse(response.json());
    expect(page.total).toBe(5);
    expect(page.all).toBe(5);
    expect(page.items.map((app) => app.key)).toEqual(['checkout-api', 'gift-cards']);
    const checkout = page.items[0];
    expect(checkout?.delivery.prodVersion).toBe('v1.43.0');
    expect(checkout?.delivery.prodState).toBe('canary');
    expect(checkout?.delivery.deploysByWeek.at(-1)).toBe(14);
    expect(checkout?.delivery.changeFailureRate).toBeCloseTo(1 / 14);
    expect(checkout?.delivery.lastRun).toBe('running');
    expect(checkout?.ownerTeam?.name).toBe('Payments');
    const next = await http.get('/applications', member(), {
      limit: '2',
      cursor: page.nextCursor ?? '',
    });
    expect(next.json().items.map((app: { key: string }) => app.key)).toEqual([
      'lake-ingest',
      'payments-worker',
    ]);
  });

  it('narrows by every facet and by search', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const keys = async (query: Record<string, string>) =>
      (await http.get('/applications', member(), query))
        .json()
        .items.map((app: { key: string }) => app.key);
    expect(await keys({ tier: '0' })).toEqual(['checkout-api', 'payments-worker']);
    expect(await keys({ domain: 'data' })).toEqual(['lake-ingest']);
    expect(await keys({ group: 'commerce/pricing' })).toEqual(['pricing-svc']);
    expect(await keys({ team: 'none' })).toEqual(['gift-cards']);
    expect(await keys({ runtime: 'function,kubernetes' })).toEqual([
      'lake-ingest',
      'payments-worker',
      'pricing-svc',
    ]);
    expect(await keys({ health: 'failing' })).toEqual(['pricing-svc']);
    expect(await keys({ mine: 'true' })).toEqual(['checkout-api', 'payments-worker']);
    expect(await keys({ q: 'PCI' })).toEqual(['checkout-api']);
    expect(await keys({ q: 'pay' })).toEqual(['payments-worker']);
    expect(await keys({ staleDays: '30' })).toEqual(['gift-cards']);
    expect(await keys({ sort: 'tier', limit: '3' })).toEqual([
      'checkout-api',
      'payments-worker',
      'pricing-svc',
    ]);
  });

  it('counts facets with each facet ignoring its own filter', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await http.get('/applications/facets', member(), { tier: '0' });
    const facets = applicationFacetsSchema.parse(response.json());
    expect(facets.tier).toEqual([
      { value: '0', label: '0', count: 2 },
      { value: '1', label: '1', count: 1 },
      { value: '2', label: '2', count: 2 },
    ]);
    expect(facets.domain).toEqual([{ value: 'commerce', label: 'Commerce', count: 2 }]);
    expect(facets.team).toEqual([{ value: fixture.teams.payments, label: 'Payments', count: 2 }]);
  });

  it('reads one application by key and answers 404 for an unknown one', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const found = await http.get('/applications/checkout-api', member());
    expect(found.statusCode).toBe(200);
    expect(found.json()).toMatchObject({ key: 'checkout-api', tier: 0, labels: ['node', 'pci'] });
    expect((await http.get('/applications/nope', member())).statusCode).toBe(404);
  });

  it('refuses people Pipelines is not granted to and rejects bad filters', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    expect((await http.get('/applications', harness.users.outsider)).statusCode).toBe(403);
    expect((await http.get('/domains', harness.users.outsider)).statusCode).toBe(403);
    expect((await http.get('/applications', member(), { tier: '7' })).statusCode).toBe(400);
  });
});
