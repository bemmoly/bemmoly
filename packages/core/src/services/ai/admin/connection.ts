import {
  ValidationError,
  type AiDiscoveredModel,
  type AiProviderDiscoverResponse,
  type AiProviderDraftTestBody,
  type AiProviderTestResponse,
  type CatalogData,
} from '@bemmoly/shared';
import type { Actor } from '../../../contracts/authz.ts';
import { suggestedDefaults } from '../catalog/overrides.ts';
import { toProviderError } from '../runtime/errors.ts';
import { loadProvider, type ProviderConnection } from '../runtime/loader.ts';
import { connectionOf } from '../runtime/model-source.ts';
import { pingModel, probeStructuredOutput, probeToolCalling } from '../runtime/registry.ts';
import { recordCheck } from '../store/providers.ts';
import { listRoles } from '../store/roles.ts';
import { authorizeAdmin, type AiServiceContext } from './context.ts';
import { checkBaseUrl, requireProvider } from './providers.ts';

/** The model a connection test calls: a role's, the suggested fast one, or the first listed. */
function testModelOf(
  catalog: CatalogData,
  connection: ProviderConnection,
  discovered: readonly AiDiscoveredModel[],
  assigned: string | undefined,
): string | null {
  if (assigned) return assigned;
  const entry = connection.protocol ? null : catalog[connection.catalogId];
  if (entry) return suggestedDefaults(entry).fast ?? Object.keys(entry.models)[0] ?? null;
  return discovered.find((model) => !model.embedding)?.id ?? null;
}

async function discover(
  ctx: AiServiceContext,
  connection: ProviderConnection,
): Promise<AiDiscoveredModel[]> {
  if (!connection.protocol || !connection.baseUrl) return [];
  const models = await ctx.modelServer.listModels({
    baseUrl: connection.baseUrl,
    protocol: connection.protocol,
    apiKey: Object.values(connection.credentials)[0] ?? null,
    headers: connection.headers,
    timeoutMs: ctx.testTimeoutMs,
  });
  return models.slice(0, 200).map((model) => ({
    id: model.id,
    name: model.name,
    toolCall: null,
    structuredOutput: null,
    embedding: model.embedding,
    contextWindow: model.contextWindow,
  }));
}

async function runTest(
  ctx: AiServiceContext,
  connection: ProviderConnection,
  assigned?: string,
): Promise<AiProviderTestResponse & { discovered: AiDiscoveredModel[] }> {
  const checkedAt = new Date().toISOString();
  const started = performance.now();
  let discovered: AiDiscoveredModel[] = [];
  let model: string | null = null;
  try {
    discovered = await discover(ctx, connection);
    const catalog = await ctx.catalog.cached();
    model = testModelOf(catalog, connection, discovered, assigned);
    if (!model) {
      return {
        ok: false,
        message: `${connection.name} lists no model to test with`,
        latencyMs: null,
        model: null,
        modelsFound: connection.protocol ? discovered.length : null,
        checkedAt,
        discovered,
      };
    }
    const provider = await loadProvider(connection);
    await pingModel(provider.languageModel(model), ctx.testTimeoutMs);
    const latencyMs = Math.round(performance.now() - started);
    return {
      ok: true,
      message: `Connected · ${connection.name} answered in ${latencyMs} ms`,
      latencyMs,
      model,
      modelsFound: connection.protocol
        ? discovered.length
        : Object.keys(catalog[connection.catalogId]?.models ?? {}).length,
      checkedAt,
      discovered,
    };
  } catch (error) {
    const failure = toProviderError(error, connection.name);
    const said = (failure.details as { providerMessage?: string | null }).providerMessage;
    return {
      ok: false,
      message: said ? `${failure.message}: ${said}` : failure.message,
      latencyMs: null,
      model,
      modelsFound: connection.protocol ? discovered.length : null,
      checkedAt,
      discovered,
    };
  }
}

/** POST /admin/ai/providers/:id/test: one cheap call with the stored values. */
export async function testAiProvider(
  ctx: AiServiceContext,
  actor: Actor,
  id: string,
): Promise<AiProviderTestResponse> {
  await authorizeAdmin(ctx, actor);
  const row = await requireProvider(ctx, id);
  const connection = await connectionOf(row, ctx.secrets, ctx.catalog.cached);
  const assigned = (await listRoles(ctx.sql)).find(
    (role) => role.providerId === id && role.role !== 'embedding',
  )?.model;
  const { discovered, ...result } = await runTest(ctx, connection, assigned);
  await recordCheck(ctx.sql, id, {
    ok: result.ok,
    error: result.ok ? null : result.message,
    ...(row.protocol && discovered.length ? { models: discovered } : {}),
  });
  return result;
}

/** POST /admin/ai/provider-tests: the same test on values not saved yet (the wizard). */
export async function testDraftProvider(
  ctx: AiServiceContext,
  actor: Actor,
  body: AiProviderDraftTestBody,
): Promise<AiProviderTestResponse> {
  await authorizeAdmin(ctx, actor);
  const catalog = await ctx.catalog.cached();
  let connection: ProviderConnection;
  if (body.kind === 'catalog') {
    const entry = catalog[body.catalogId];
    if (!entry) throw new ValidationError(`The catalog has no provider "${body.catalogId}"`);
    await checkBaseUrl(ctx, body.baseUrl, false);
    connection = {
      catalogId: entry.id,
      npm: entry.npm,
      protocol: null,
      name: body.name ?? entry.name,
      baseUrl: body.baseUrl ?? entry.api ?? null,
      credentials: body.credentials,
      headers: body.headers,
    };
  } else {
    await checkBaseUrl(ctx, body.baseUrl, true);
    connection = {
      catalogId: 'custom',
      npm: null,
      protocol: body.protocol,
      name: body.name,
      baseUrl: body.baseUrl,
      credentials: body.apiKey ? { API_KEY: body.apiKey } : {},
      headers: body.headers,
    };
  }
  const { ok, message, latencyMs, model, modelsFound, checkedAt } = await runTest(ctx, connection);
  return { ok, message, latencyMs, model, modelsFound, checkedAt };
}

/**
 * POST /admin/ai/providers/:id/discover: a Local server's models, with one tool-calling and
 * one structured-output probe per model (the first 20), stored as its private catalog entry.
 */
export async function discoverAiProvider(
  ctx: AiServiceContext,
  actor: Actor,
  id: string,
): Promise<AiProviderDiscoverResponse> {
  await authorizeAdmin(ctx, actor);
  const row = await requireProvider(ctx, id);
  if (!row.protocol) {
    throw new ValidationError(
      'Only a Local server discovers its models; catalog providers list theirs',
    );
  }
  const connection = await connectionOf(row, ctx.secrets, ctx.catalog.cached);
  let models: AiDiscoveredModel[];
  try {
    models = await discover(ctx, connection);
  } catch (error) {
    throw toProviderError(error, row.name);
  }
  const provider = await loadProvider(connection);
  const probed: AiDiscoveredModel[] = [];
  for (const [index, model] of models.entries()) {
    if (model.embedding || index >= 20) {
      probed.push(model);
      continue;
    }
    const language = provider.languageModel(model.id);
    const [toolCall, structuredOutput] = await Promise.all([
      probeToolCalling(language, ctx.testTimeoutMs * 3),
      probeStructuredOutput(language, ctx.testTimeoutMs * 3),
    ]);
    probed.push({ ...model, toolCall, structuredOutput });
  }
  await recordCheck(ctx.sql, id, { ok: true, error: null, models: probed });
  return { models: probed, checkedAt: new Date().toISOString() };
}
