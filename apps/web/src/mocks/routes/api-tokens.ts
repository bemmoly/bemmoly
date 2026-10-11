import { createApiTokenSchema, type ApiToken } from '@bemmoly/shared';
import { audit, type MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, invalid, notFound, ok, type MockRoute } from '../types.ts';

/** A secret shaped like the server's: a fixed prefix, then random characters. */
function secret(): string {
  return `bmly_${newId().replaceAll('-', '')}${newId().replaceAll('-', '').slice(0, 8)}`;
}

/** The mock keeps one person's tokens; the server scopes the list to the signed-in owner. */
const mine = (db: MockDb) => db.apiTokens;

export const apiTokenRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/api-tokens',
    handle: (_, db) => ok({ items: mine(db) }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/api-tokens',
    handle: (request, db) => {
      const parsed = createApiTokenSchema.safeParse(bodyOf(request));
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return invalid(String(issue?.path[0] ?? 'name'), issue?.message ?? 'Invalid value');
      }
      const token = secret();
      const apiToken: ApiToken = {
        id: newId(),
        name: parsed.data.name,
        prefix: token.slice(0, 12),
        scopes: parsed.data.scopes,
        modules: parsed.data.modules ?? null,
        lastUsedAt: null,
        expiresAt: parsed.data.expiresAt ?? null,
        createdAt: new Date().toISOString(),
      };
      db.apiTokens.unshift(apiToken);
      audit(db, 'api_token.created', 'api_token', apiToken.id);
      return ok({ token, apiToken }, 201);
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/api-tokens/:id',
    handle: (request, db) => {
      const id = request.params['id'];
      const found = mine(db).find((token) => token.id === id);
      if (!found) return notFound('Access token');
      db.apiTokens = db.apiTokens.filter((token) => token !== found);
      audit(db, 'api_token.revoked', 'api_token', found.id);
      return ok();
    },
  },
];
