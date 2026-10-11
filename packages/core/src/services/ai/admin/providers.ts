import { randomUUID } from 'node:crypto';
import {
  NotFoundError,
  ValidationError,
  type AiProvider,
  type AiProviderCreateBody,
  type AiProviderUpdateBody,
  type CatalogData,
} from '@bemmoly/shared';
import { assertAddressAllowed } from '../../../clients/guarded-fetch.ts';
import type { Actor } from '../../../contracts/authz.ts';
import { loaderKindOf } from '../runtime/loader.ts';
import {
  deleteProvider,
  findProvider,
  insertProvider,
  listProviders,
  openSecrets,
  sealSecrets,
  updateProvider,
  type ProviderRow,
} from '../store/providers.ts';
import { listRoles } from '../store/roles.ts';
import { announceChange, authorizeAdmin, userIdOf, type AiServiceContext } from './context.ts';

/** The API shape: credential names only, never values. */
export function toApiProvider(row: ProviderRow, catalog: CatalogData): AiProvider {
  return {
    id: row.id,
    catalogId: row.catalogId,
    name: row.name,
    protocol: row.protocol,
    baseUrl: row.baseUrl,
    loader: row.protocol ? 'compatible' : loaderKindOf(catalog[row.catalogId]?.npm),
    credentialsSet: row.credentialNames,
    headersSet: row.headerNames,
    models: row.models,
    isDefault: row.isDefault,
    status: row.status,
    lastCheckedAt: row.lastCheckedAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * A base URL the server will call: http(s), and on a public address unless it is a Local
 * server (private by design, but never link-local, where cloud metadata answers) or the
 * operator allowed private URLs. Every call is checked again when it is made.
 */
export async function checkBaseUrl(
  ctx: AiServiceContext,
  url: string | null | undefined,
  custom: boolean,
): Promise<void> {
  if (!url) return;
  const parsed = new URL(url);
  if (parsed.username || parsed.password) {
    throw new ValidationError('Put credentials in their fields, not in the base URL');
  }
  if (ctx.allowPrivateUrls || ctx.recorded) return;
  try {
    await assertAddressAllowed(url, custom ? 'local' : 'public');
  } catch (error) {
    throw new ValidationError(
      error instanceof Error ? error.message : 'The base URL is not reachable',
    );
  }
}

export async function listAiProviders(ctx: AiServiceContext, actor: Actor) {
  await authorizeAdmin(ctx, actor);
  const [rows, catalog] = await Promise.all([listProviders(ctx.sql), ctx.catalog.cached()]);
  return { items: rows.map((row) => toApiProvider(row, catalog)) };
}

export async function createAiProvider(
  ctx: AiServiceContext,
  actor: Actor,
  body: AiProviderCreateBody,
): Promise<AiProvider> {
  await authorizeAdmin(ctx, actor);
  const id = randomUUID();
  const catalog = await ctx.catalog.cached();
  let write;
  if (body.kind === 'catalog') {
    const entry = catalog[body.catalogId];
    if (!entry) throw new ValidationError(`The catalog has no provider "${body.catalogId}"`);
    await checkBaseUrl(ctx, body.baseUrl, false);
    write = {
      catalogId: body.catalogId,
      protocol: null,
      name: body.name ?? entry.name,
      baseUrl: body.baseUrl ?? null,
      credentials: body.credentials,
    };
  } else {
    await checkBaseUrl(ctx, body.baseUrl, true);
    write = {
      catalogId: 'custom',
      protocol: body.protocol,
      name: body.name,
      baseUrl: body.baseUrl,
      credentials: body.apiKey ? { API_KEY: body.apiKey } : {},
    };
  }
  await insertProvider(ctx.sql, {
    id,
    ...write,
    credentialNames: Object.keys(write.credentials).sort(),
    credentialsSealed: sealSecrets(ctx.secrets, id, 'credentials', write.credentials),
    headerNames: Object.keys(body.headers).sort(),
    headersSealed: sealSecrets(ctx.secrets, id, 'headers', body.headers),
    models: [],
    isDefault: body.isDefault ?? (await listProviders(ctx.sql)).length === 0,
    createdBy: userIdOf(actor),
  });
  const row = await findProvider(ctx.sql, id);
  return toApiProvider(row!, catalog);
}

function merge(
  stored: Record<string, string>,
  change: Readonly<Record<string, string | null>> | undefined,
): Record<string, string> {
  if (!change) return stored;
  const next = { ...stored };
  for (const [name, value] of Object.entries(change)) {
    if (value === null) delete next[name];
    else next[name] = value;
  }
  return next;
}

export async function requireProvider(ctx: AiServiceContext, id: string): Promise<ProviderRow> {
  const row = await findProvider(ctx.sql, id);
  if (!row) throw new NotFoundError('That AI provider does not exist');
  return row;
}

export async function updateAiProvider(
  ctx: AiServiceContext,
  actor: Actor,
  id: string,
  body: AiProviderUpdateBody,
): Promise<AiProvider> {
  await authorizeAdmin(ctx, actor);
  const row = await requireProvider(ctx, id);
  if (body.baseUrl !== undefined) await checkBaseUrl(ctx, body.baseUrl, row.protocol !== null);
  const credentials = merge(
    openSecrets(ctx.secrets, id, 'credentials', row.credentialsSealed),
    body.credentials,
  );
  const headers = merge(openSecrets(ctx.secrets, id, 'headers', row.headersSealed), body.headers);
  await updateProvider(ctx.sql, id, {
    name: body.name ?? row.name,
    baseUrl: body.baseUrl === undefined ? row.baseUrl : body.baseUrl,
    credentialNames: Object.keys(credentials).sort(),
    credentialsSealed: sealSecrets(ctx.secrets, id, 'credentials', credentials),
    headerNames: Object.keys(headers).sort(),
    headersSealed: sealSecrets(ctx.secrets, id, 'headers', headers),
    models: row.models,
    isDefault: body.isDefault ?? row.isDefault,
  });
  await announceChange(ctx, actor, ['roles']);
  return toApiProvider((await findProvider(ctx.sql, id))!, await ctx.catalog.cached());
}

export async function deleteAiProvider(ctx: AiServiceContext, actor: Actor, id: string) {
  await authorizeAdmin(ctx, actor);
  const roles = (await listRoles(ctx.sql)).filter((role) => role.providerId === id);
  if (!(await deleteProvider(ctx.sql, id)))
    throw new NotFoundError('That AI provider does not exist');
  if (roles.length) {
    const reasons = roles.some((role) => role.role === 'embedding')
      ? (['roles', 'embedding_role'] as const)
      : (['roles'] as const);
    await announceChange(ctx, actor, reasons);
  }
}
