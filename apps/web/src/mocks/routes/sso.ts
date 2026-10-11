import {
  createScimTokenSchema,
  createSsoProviderSchema,
  updateSsoPolicySchema,
  updateSsoProviderSchema,
  type ScimToken,
  type SsoProvider,
} from '@bemmoly/shared';
import { audit, can, currentUser, type MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import { fail, invalid, ok, type MockRoute } from '../types.ts';

const CONFIGURE = 'workspace.sso.configure';
const ORIGIN = 'http://localhost:5173';

export interface MockSso {
  providers: SsoProvider[];
  requireSso: boolean;
  scimTokens: ScimToken[];
}

/** Single sign-on state, added on first use so a stored mock from before it still loads. */
export function ssoOf(db: MockDb): MockSso {
  db.sso ??= { providers: [], requireSso: false, scimTokens: [] };
  return db.sso;
}

const forbidden = () =>
  fail(403, 'forbidden', 'You need the "Configure single sign-on" capability.');
const needs =
  (handle: MockRoute['handle']): MockRoute['handle'] =>
  (request, db) =>
    can(db, CONFIGURE) ? handle(request, db) : forbidden();

function serviceProvider(id: string, protocol: 'oidc' | 'saml') {
  const base = `${ORIGIN}/api/v1/auth/sso/providers/${id}`;
  return {
    callbackUrl: `${base}/callback`,
    entityId: `${base}/metadata`,
    metadataUrl: protocol === 'saml' ? `${base}/metadata` : null,
  };
}

function presentConfig(config: Record<string, unknown>, previous?: SsoProvider['config']) {
  if (config['protocol'] === 'oidc') {
    const { clientSecret, ...rest } = config;
    const kept = previous?.protocol === 'oidc' && previous.hasClientSecret;
    return { ...rest, hasClientSecret: Boolean(clientSecret) || kept } as SsoProvider['config'];
  }
  const rest = { ...config };
  delete rest['idpCertificate'];
  return {
    ...rest,
    certificateFingerprint: 'AB:CD:EF:01:23:45:67:89',
    certificateExpiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
  } as SsoProvider['config'];
}

/** Active org admins, as the policy lists them, with whether they keep a password. */
export function policyAdmins(db: MockDb) {
  const adminRole = db.roles.find((role) => role.key === 'org_admin')?.id;
  return db.users
    .filter((user) => user.status === 'active' && user.roleId === adminRole)
    .map(({ id, name, email, isBreakGlass }) => ({
      id,
      name,
      email,
      breakGlass: isBreakGlass,
      hasPassword: db.passwords[email] !== undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const breakGlass = (db: MockDb) =>
  policyAdmins(db)
    .filter((admin) => admin.breakGlass && admin.hasPassword)
    .map(({ id, name, email }) => ({ id, name, email }));

/** The policy as GET /admin/sso/policy answers it. */
export const policyOf = (db: MockDb) => ({
  requireSso: ssoOf(db).requireSso,
  breakGlassAdmins: breakGlass(db),
  admins: policyAdmins(db),
});

/** Settings › Sign-in and SSO and the sign-in page's options, as the server answers them. */
export const ssoRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/auth/sso/providers',
    anonymous: true,
    handle: (_, db) => {
      const sso = ssoOf(db);
      const items = sso.providers
        .filter((row) => row.enabled)
        .map(({ id, displayName, protocol, preset }) => ({ id, displayName, protocol, preset }));
      return ok({ items, requireSso: sso.requireSso });
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/sso/providers',
    handle: needs((_, db) => ok({ items: ssoOf(db).providers })),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/sso/providers',
    handle: needs((request, db) => {
      const parsed = createSsoProviderSchema.safeParse(request.body);
      if (!parsed.success)
        return invalid(String(parsed.error.issues[0]?.path.join('.')), 'Check this field');
      const id = newId();
      const now = new Date().toISOString();
      const { config, teamMappings, ...rest } = parsed.data;
      const row: SsoProvider = {
        ...rest,
        id,
        protocol: config.protocol,
        teamMappings,
        config: presentConfig(config),
        serviceProvider: serviceProvider(id, config.protocol),
        lastTest: null,
        createdAt: now,
        updatedAt: now,
      };
      ssoOf(db).providers.push(row);
      audit(db, 'sso.provider_created', 'auth_provider', id);
      return ok(row, 201);
    }),
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/admin/sso/providers/:id',
    handle: needs((request, db) => {
      const row = ssoOf(db).providers.find((item) => item.id === request.params['id']);
      if (!row) return fail(404, 'not_found', 'That provider no longer exists.');
      const parsed = updateSsoProviderSchema.safeParse(request.body);
      if (!parsed.success)
        return invalid(String(parsed.error.issues[0]?.path.join('.')), 'Check this field');
      const { config, ...rest } = parsed.data;
      Object.assign(row, rest, { updatedAt: new Date().toISOString() });
      if (config) Object.assign(row, { config: presentConfig(config, row.config), lastTest: null });
      audit(db, 'sso.provider_updated', 'auth_provider', row.id);
      return ok(row);
    }),
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/admin/sso/providers/:id',
    handle: needs((request, db) => {
      const sso = ssoOf(db);
      sso.providers = sso.providers.filter((item) => item.id !== request.params['id']);
      return ok();
    }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/sso/providers/:id/tests',
    // No identity provider behind the mock: the round trip passes at once and lands back here.
    handle: needs((request, db) => {
      const row = ssoOf(db).providers.find((item) => item.id === request.params['id']);
      if (!row) return fail(404, 'not_found', 'That provider no longer exists.');
      const me = currentUser(db);
      row.lastTest = {
        at: new Date().toISOString(),
        ok: true,
        reason: null,
        message: null,
        email: me?.email ?? null,
        groups: ['engineering'],
      };
      return ok({ authorizationUrl: '/settings/authentication' }, 201);
    }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/sso/policy',
    handle: needs((_, db) => ok(policyOf(db))),
  },
  {
    method: 'PUT',
    pattern: '/api/v1/admin/sso/policy',
    handle: needs((request, db) => {
      const sso = ssoOf(db);
      const { requireSso } = updateSsoPolicySchema.parse(request.body);
      if (requireSso && !sso.providers.some((row) => row.enabled && row.lastTest?.ok)) {
        return fail(
          409,
          'conflict',
          'Run a successful test sign-in with an enabled provider first.',
        );
      }
      sso.requireSso = requireSso;
      return ok(policyOf(db));
    }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/scim-tokens',
    handle: needs((_, db) => ok({ items: ssoOf(db).scimTokens, baseUrl: `${ORIGIN}/scim/v2` })),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/scim-tokens',
    handle: needs((request, db) => {
      const { name } = createScimTokenSchema.parse(request.body);
      const token = `bmscim_mock-${newId().replace(/-/g, '')}`;
      const row = {
        id: newId(),
        name,
        prefix: token.slice(0, 14),
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
      };
      ssoOf(db).scimTokens.push(row);
      return ok({ token, scimToken: row }, 201);
    }),
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/admin/scim-tokens/:id',
    handle: needs((request, db) => {
      const sso = ssoOf(db);
      sso.scimTokens = sso.scimTokens.filter((row) => row.id !== request.params['id']);
      return ok();
    }),
  },
];
