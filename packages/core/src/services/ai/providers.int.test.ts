import type { CatalogProvider } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aiAdmin } from './index.ts';
import { scriptedModelsDev, startAiFixture, type AiFixture } from './ai-fixture.ts';
import { eligibleRoles } from './catalog/overrides.ts';

describe('AI providers, roles and catalog snapshots against a real database', () => {
  let fx: AiFixture | undefined;
  let skip = '';

  beforeAll(async () => {
    const started = await startAiFixture();
    if ('skip' in started) skip = started.skip;
    else fx = started;
  });
  afterAll(async () => fx?.close());

  /** A bundled provider that the compatible client serves, so nothing vendor-specific. */
  async function compatibleProvider(): Promise<CatalogProvider> {
    const data = await fx!.build().context.catalog.cached();
    return Object.values(data).find(
      (p) =>
        p.npm === '@ai-sdk/openai-compatible' &&
        p.env.length > 0 &&
        p.api &&
        Object.keys(p.models).length > 2,
    )!;
  }

  it('stores credentials sealed and never returns them', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const { context } = fx.build();
    const entry = await compatibleProvider();
    const secret = 'sk-integration-test-secret-value';
    const created = await aiAdmin.createAiProvider(context, fx.admin, {
      kind: 'catalog',
      catalogId: entry.id,
      credentials: { [entry.env[0]!]: secret },
      headers: { 'X-Team': 'platform-header-secret' },
    });
    expect(created).toMatchObject({
      catalogId: entry.id,
      name: entry.name,
      credentialsSet: [entry.env[0]],
      headersSet: ['X-Team'],
      isDefault: true,
      status: 'unchecked',
      loader: 'compatible',
    });
    expect(JSON.stringify(created)).not.toContain(secret);
    const listed = await aiAdmin.listAiProviders(context, fx.admin);
    expect(JSON.stringify(listed)).not.toContain(secret);
    expect(JSON.stringify(listed)).not.toContain('platform-header-secret');
    const [raw] = await fx.sql<{ credentials_encrypted: string }[]>`
      select credentials_encrypted from ai_providers where id = ${created.id}`;
    expect(raw?.credentials_encrypted).toMatch(/^v1\./);
    expect(raw?.credentials_encrypted).not.toContain(secret);

    const renamed = await aiAdmin.updateAiProvider(context, fx.admin, created.id, {
      name: 'Team gateway',
      credentials: { EXTRA_TOKEN: 'second-secret-value' },
      headers: { 'X-Team': null },
    });
    expect(renamed).toMatchObject({
      name: 'Team gateway',
      credentialsSet: [entry.env[0], 'EXTRA_TOKEN'].sort(),
      headersSet: [],
    });
    await expect(aiAdmin.listAiProviders(context, fx.member)).rejects.toMatchObject({
      name: 'ForbiddenError',
    });
    await aiAdmin.deleteAiProvider(context, fx.admin, created.id);
    expect((await aiAdmin.listAiProviders(context, fx.admin)).items).toEqual([]);
  });

  it('assigns roles with a capabilities snapshot and refuses models that do not fit', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const { context, facade } = fx.build();
    const entry = await compatibleProvider();
    const provider = await aiAdmin.createAiProvider(context, fx.admin, {
      kind: 'catalog',
      catalogId: entry.id,
      credentials: { [entry.env[0]!]: 'k' },
      headers: {},
    });
    const models = Object.values(entry.models);
    const fast = models.find((m) => eligibleRoles(m).includes('fast'))!;
    const role = await aiAdmin.putAiRole(context, fx.admin, 'fast', {
      providerId: provider.id,
      model: fast.id,
      reasoningEffort: null,
      maxOutputTokens: 512,
      temperature: null,
    });
    expect(role).toMatchObject({
      role: 'fast',
      model: fast.id,
      providerName: entry.name,
      maxOutputTokens: 512,
      paused: false,
      capabilities: { toolCall: fast.tool_call ?? false },
    });
    await expect(
      aiAdmin.putAiRole(context, fx.admin, 'fast', {
        providerId: provider.id,
        model: 'no-such-model',
        reasoningEffort: null,
        maxOutputTokens: null,
        temperature: null,
      }),
    ).rejects.toThrow(/no model "no-such-model"/);
    const roles = await aiAdmin.listAiRoles(context, fx.admin);
    expect(roles.items.map((item) => [item.role, item.assignment?.model ?? null])).toEqual([
      ['fast', fast.id],
      ['standard', null],
      ['strong', null],
      ['embedding', null],
    ]);
    expect(await facade.embeddingModel()).toBeNull();
    expect(fx.events.at(-1)).toMatchObject({
      kind: 'ai.settings.changed',
      payload: { reasons: ['roles'] },
    });
    // Removing the provider removes its roles with it.
    await aiAdmin.deleteAiProvider(context, fx.admin, provider.id);
    expect((await aiAdmin.listAiRoles(context, fx.admin)).items[0]?.assignment).toBeNull();
  });

  it('keeps the last good snapshot: live, then stored after an outage, then an upload', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const live = {
      acme: {
        id: 'acme',
        name: 'Acme AI',
        env: ['ACME_API_KEY'],
        npm: '',
        api: 'https://acme.test/v1',
        doc: '',
        models: {},
      },
    };
    const online = fx.build({ modelsDev: scriptedModelsDev([() => live]) });
    const first = await aiAdmin.getAiCatalog(online.context, fx.admin);
    expect(first.status).toMatchObject({ source: 'live', offline: false, providerCount: 1 });
    const [stored] = await fx.sql<{ source: string; etag: string }[]>`
      select source, etag from ai_catalog_snapshots where is_current`;
    expect(stored).toEqual({ source: 'live', etag: '"test"' });

    const restarted = fx.build({ modelsDev: scriptedModelsDev() });
    const offline = await aiAdmin.getAiCatalog(restarted.context, fx.admin);
    expect(offline.status).toMatchObject({ source: 'live', offline: true, providerCount: 1 });
    expect(offline.status.line).toMatch(/^Offline · last fetched \d{1,2} \w+ \d{4}$/);

    const uploaded = await aiAdmin.uploadAiCatalog(restarted.context, fx.admin, {
      ...live,
      beta: { ...live.acme, id: 'beta', name: 'Beta AI' },
    });
    expect(uploaded.status).toMatchObject({ source: 'uploaded', providerCount: 2 });
    const again = fx.build({ modelsDev: scriptedModelsDev() });
    expect((await again.context.catalog.resolve()).status.source).toBe('uploaded');
  });
});
