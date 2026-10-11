import {
  aiProviderCreateBodySchema,
  aiProviderUpdateBodySchema,
  type AiProvider,
  type AiProviderCreateBody,
} from '@bemmoly/shared';
import type { MockDb } from '../db.ts';
import { catalogSummary } from '../seed/ai-catalog.ts';
import { newId } from '../seed/time.ts';
import { fail, invalid, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import { aiOf, changed, denied, LOCAL_MODELS, parse, testResult } from './ai-state.ts';

const ADMIN = '/api/v1/admin/ai';

function nameAndSecrets(body: AiProviderCreateBody) {
  if (body.kind === 'custom') {
    return {
      name: body.name,
      baseUrl: body.baseUrl,
      secrets: body.apiKey ? { apiKey: body.apiKey } : {},
    };
  }
  const summary = catalogSummary(body.catalogId);
  return {
    name: body.name ?? summary?.name ?? body.catalogId,
    baseUrl: body.baseUrl ?? summary?.api ?? null,
    secrets: body.credentials,
  };
}

function created(db: MockDb, body: AiProviderCreateBody): AiProvider | null {
  const custom = body.kind === 'custom';
  const summary = custom ? null : catalogSummary(body.catalogId);
  if (!custom && !summary) return null;
  const { name, baseUrl, secrets } = nameAndSecrets(body);
  const now = new Date().toISOString();
  const id = newId();
  const result = testResult(name, baseUrl, Object.values(secrets), custom);
  aiOf(db).secrets[id] = { ...secrets };
  return {
    id,
    catalogId: custom ? 'custom' : body.catalogId,
    name,
    protocol: custom ? body.protocol : null,
    baseUrl,
    loader: summary?.loader ?? 'compatible',
    credentialsSet: Object.keys(secrets),
    headersSet: Object.keys(body.headers),
    models: custom && result.ok ? LOCAL_MODELS.map((model) => ({ ...model })) : [],
    isDefault: body.isDefault ?? aiOf(db).providers.length === 0,
    status: result.ok ? 'ok' : 'failed',
    lastCheckedAt: result.checkedAt,
    lastError: result.ok ? null : result.message,
    createdAt: now,
    updatedAt: now,
  };
}

function provider(db: MockDb, request: MockRequest) {
  return aiOf(db).providers.find((entry) => entry.id === request.params['id']);
}

export const aiProviderRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${ADMIN}/providers`,
    handle: (_, db) => denied(db) ?? ok({ items: aiOf(db).providers }),
  },
  {
    method: 'POST',
    pattern: `${ADMIN}/providers`,
    handle: (request, db) => {
      const refused = denied(db);
      if (refused) return refused;
      const parsed = parse(aiProviderCreateBodySchema, request);
      if (parsed.refused) return parsed.refused;
      const body = parsed.data;
      const row = created(db, body);
      if (!row) return invalid('catalogId', 'The catalog has no provider with that id.');
      const ai = aiOf(db);
      if (row.isDefault) ai.providers.forEach((entry) => (entry.isDefault = false));
      ai.providers.push(row);
      if (!ai.settings.providerChoice)
        ai.settings.providerChoice = body.kind === 'custom' ? 'local' : body.catalogId;
      changed(db, 'ai.provider.created', row.id);
      return ok(row, 201);
    },
  },
  {
    method: 'PATCH',
    pattern: `${ADMIN}/providers/:id`,
    handle: (request, db) => {
      const refused = denied(db);
      if (refused) return refused;
      const row = provider(db, request);
      if (!row) return notFound('Provider');
      const parsed = parse(aiProviderUpdateBodySchema, request);
      if (parsed.refused) return parsed.refused;
      const body = parsed.data;
      const secrets = (aiOf(db).secrets[row.id] ??= {});
      for (const [name, value] of Object.entries(body.credentials ?? {})) {
        if (value === null) delete secrets[name];
        else secrets[name] = value;
      }
      Object.assign(row, {
        ...(body.name ? { name: body.name } : {}),
        ...(body.baseUrl !== undefined ? { baseUrl: body.baseUrl } : {}),
        credentialsSet: Object.keys(secrets),
        updatedAt: new Date().toISOString(),
      });
      changed(db, 'ai.provider.updated', row.id);
      return ok(row);
    },
  },
  {
    method: 'DELETE',
    pattern: `${ADMIN}/providers/:id`,
    handle: (request, db) => {
      const refused = denied(db);
      if (refused) return refused;
      const ai = aiOf(db);
      const row = provider(db, request);
      if (!row) return notFound('Provider');
      const inUse = Object.values(ai.roles).filter((role) => role?.providerId === row.id);
      if (inUse.length > 0) {
        return fail(
          409,
          'conflict',
          `${row.name} still fills ${inUse.map((role) => role?.role).join(', ')}. Choose other models for those roles first.`,
        );
      }
      ai.providers = ai.providers.filter((entry) => entry.id !== row.id);
      changed(db, 'ai.provider.deleted', row.id);
      return ok();
    },
  },
  {
    method: 'POST',
    pattern: `${ADMIN}/providers/:id/test`,
    handle: (request, db) => {
      const refused = denied(db);
      if (refused) return refused;
      const row = provider(db, request);
      if (!row) return notFound('Provider');
      const secrets = Object.values(aiOf(db).secrets[row.id] ?? {});
      const result = testResult(row.name, row.baseUrl, secrets, row.catalogId === 'custom');
      Object.assign(row, {
        status: result.ok ? 'ok' : 'failed',
        lastCheckedAt: result.checkedAt,
        lastError: result.ok ? null : result.message,
      });
      return ok(result);
    },
  },
  {
    method: 'POST',
    pattern: `${ADMIN}/providers/:id/discover`,
    handle: (request, db) => {
      const refused = denied(db);
      if (refused) return refused;
      const row = provider(db, request);
      if (!row) return notFound('Provider');
      row.models = LOCAL_MODELS.map((model) => ({ ...model }));
      return ok({ models: row.models, checkedAt: new Date().toISOString() });
    },
  },
  {
    method: 'POST',
    pattern: `${ADMIN}/provider-tests`,
    handle: (request, db) => {
      const refused = denied(db);
      if (refused) return refused;
      const parsed = parse(aiProviderCreateBodySchema, request);
      if (parsed.refused) return parsed.refused;
      const body = parsed.data;
      const { name, baseUrl, secrets } = nameAndSecrets(body);
      return ok(testResult(name, baseUrl, Object.values(secrets), body.kind === 'custom'));
    },
  },
];
