import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { savedViewSchema, savedViewsResponseSchema } from '../../../../shared/saved-views.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';

describe('saved views', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    http = await startPipelinesHttp(harness);
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  it("keeps a person's views to themselves, in the order saved", async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { member, admin } = harness.users;
    const save = (name: string, query: Record<string, string>) =>
      http.send('POST', '/views', member, { name, screen: 'catalog', query });
    const first = await save('Tier 0 in Commerce', { scope: 'commerce', tier: '0' });
    expect(first.statusCode, first.body).toBe(201);
    expect(savedViewSchema.parse(first.json()).query).toEqual({ scope: 'commerce', tier: '0' });
    await save('Mine', { mine: 'true' });
    const mine = savedViewsResponseSchema.parse(
      (await http.get('/views', member, { screen: 'catalog' })).json(),
    );
    expect(mine.items.map((view) => view.name)).toEqual(['Tier 0 in Commerce', 'Mine']);
    const theirs = savedViewsResponseSchema.parse(
      (await http.get('/views', admin, { screen: 'catalog' })).json(),
    );
    expect(theirs.items).toEqual([]);
    const id = mine.items[0]?.id ?? '';
    expect((await http.send('DELETE', `/views/${id}`, admin)).statusCode).toBe(404);
    expect((await http.send('DELETE', `/views/${id}`, member)).statusCode).toBe(204);
  });

  it('refuses a filter name the address could not hold', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await http.send('POST', '/views', harness.users.member, {
      name: 'Odd',
      screen: 'catalog',
      query: { 'not a key': 'x' },
    });
    expect(response.statusCode).toBe(400);
  });
});
