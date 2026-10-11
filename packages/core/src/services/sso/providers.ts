import {
  ConflictError,
  ValidationError,
  type CreateSsoProviderInput,
  type SsoConfigInput,
  type SsoProvider,
  type UpdateSsoProviderInput,
} from '@bemmoly/shared';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { authIdentities, authProviders, roles, teams } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import { ORG_ADMIN_ROLE_KEY, type RequestContext } from '../authz/index.ts';
import {
  findProviderRow,
  isCertificate,
  loadedOf,
  loadProvider,
  presentProvider,
  sealConfig,
  type LoadedProvider,
} from './config.ts';
import type { SsoDependencies } from './deps.ts';
import { isPasswordSignInOff } from './policy.ts';
import type { StoredConfig, StoredOidcConfig } from './protocol.ts';
import { forgetOidcDiscovery, isLoopbackHttp } from './protocols/oidc.ts';

export const CONFIGURE = 'workspace.sso.configure' as const;

type Deps = Pick<SsoDependencies, 'db' | 'secrets' | 'publicUrl'>;

function checkConfig(config: SsoConfigInput): void {
  const url = config.protocol === 'oidc' ? config.issuerUrl : config.idpSsoUrl;
  if (new URL(url).protocol === 'http:' && !isLoopbackHttp(url)) {
    throw new ValidationError('Use an https address for the identity provider', {
      details: { field: config.protocol === 'oidc' ? 'issuerUrl' : 'idpSsoUrl' },
    });
  }
  if (config.protocol === 'saml' && !isCertificate(config.idpCertificate)) {
    throw new ValidationError('The certificate does not parse; paste the PEM from the provider', {
      details: { field: 'idpCertificate' },
    });
  }
}

/** Roles and teams named by mappings exist; mapping a group to Org admin takes an org admin. */
async function checkReferences(
  db: Database,
  ctx: RequestContext,
  input: Pick<UpdateSsoProviderInput, 'defaultRoleId' | 'roleMappings' | 'teamMappings'>,
): Promise<void> {
  const roleIds = [
    ...(input.defaultRoleId ? [input.defaultRoleId] : []),
    ...(input.roleMappings ?? []).map((mapping) => mapping.roleId),
  ];
  if (roleIds.length > 0) {
    const found = await db
      .select({ id: roles.id, key: roles.key })
      .from(roles)
      .where(inArray(roles.id, roleIds));
    if (found.length !== new Set(roleIds).size)
      throw new ValidationError('A mapped role does not exist');
    if (
      found.some((role) => role.key === ORG_ADMIN_ROLE_KEY) &&
      !(await ctx.authz.isOrgAdmin(ctx.actor))
    ) {
      throw new ValidationError('Only org admins can map a group to the Org admin role');
    }
  }
  const teamIds = (input.teamMappings ?? []).map((mapping) => mapping.teamId);
  if (teamIds.length > 0) {
    const found = await db.select({ id: teams.id }).from(teams).where(inArray(teams.id, teamIds));
    if (found.length !== new Set(teamIds).size)
      throw new ValidationError('A mapped team does not exist');
  }
}

/** A new configuration merged over the stored one: an omitted client secret is kept. */
function mergeConfig(stored: StoredConfig | null, next: SsoConfigInput): StoredConfig {
  if (next.protocol !== 'oidc') return next;
  const previous = stored?.protocol === 'oidc' ? (stored as StoredOidcConfig) : null;
  const clientSecret = next.clientSecret ?? previous?.clientSecret;
  return { ...next, ...(clientSecret ? { clientSecret } : {}) };
}

export async function listSsoProviders(deps: Deps, ctx: RequestContext): Promise<SsoProvider[]> {
  await ctx.authz.authorize(ctx.actor, CONFIGURE, { kind: 'workspace' });
  const rows = await deps.db
    .select()
    .from(authProviders)
    .where(ne(authProviders.kind, 'password'))
    .orderBy(asc(authProviders.createdAt));
  return rows.map((row) => presentProvider(loadedOf(deps.secrets, row), deps.publicUrl));
}

export async function getSsoProvider(deps: Deps, ctx: RequestContext, id: string) {
  await ctx.authz.authorize(ctx.actor, CONFIGURE, { kind: 'workspace' });
  return presentProvider(await loadProvider(deps.db, deps.secrets, id), deps.publicUrl);
}

export async function createSsoProvider(
  deps: Deps,
  ctx: RequestContext,
  input: CreateSsoProviderInput,
): Promise<SsoProvider> {
  await ctx.authz.authorize(ctx.actor, CONFIGURE, { kind: 'workspace' });
  checkConfig(input.config);
  await checkReferences(deps.db, ctx, input);
  const id = await deps.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(authProviders)
      .values({
        kind: input.config.protocol,
        displayName: input.displayName,
        preset: input.preset,
        enabled: input.enabled,
        autoProvision: input.autoProvision,
        defaultRoleId: input.defaultRoleId,
        allowedDomains: input.allowedDomains,
        roleMappings: input.roleMappings,
        groupMappings: input.teamMappings,
      })
      .returning({ id: authProviders.id });
    if (!row) throw new Error('Provider insert returned no row');
    const configEncrypted = sealConfig(deps.secrets, row.id, mergeConfig(null, input.config));
    await tx.update(authProviders).set({ configEncrypted }).where(eq(authProviders.id, row.id));
    const created = await loadProvider(tx, deps.secrets, row.id);
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'sso.provider_created',
      target: { kind: 'auth_provider', id: row.id },
      after: presentProvider(created, deps.publicUrl),
      meta: ctx,
    });
    return row.id;
  });
  return presentProvider(await loadProvider(deps.db, deps.secrets, id), deps.publicUrl);
}

async function assertNotLastWhileRequired(db: Database, provider: LoadedProvider) {
  if (!(await isPasswordSignInOff(db))) return;
  const others = await db
    .select({ id: authProviders.id })
    .from(authProviders)
    .where(
      and(
        ne(authProviders.kind, 'password'),
        ne(authProviders.id, provider.row.id),
        eq(authProviders.enabled, true),
      ),
    )
    .limit(1);
  if (others.length === 0) {
    throw new ConflictError(
      'Single sign-on is required and this is the only provider; turn off "Require SSO" first',
    );
  }
}

export async function updateSsoProvider(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  input: UpdateSsoProviderInput,
): Promise<SsoProvider> {
  await ctx.authz.authorize(ctx.actor, CONFIGURE, { kind: 'workspace' });
  const before = await loadProvider(deps.db, deps.secrets, id);
  if (input.config) {
    if (input.config.protocol !== before.protocol) {
      throw new ValidationError('A provider keeps its protocol; add a new provider instead');
    }
    checkConfig(input.config);
  }
  if (input.enabled === false) await assertNotLastWhileRequired(deps.db, before);
  await checkReferences(deps.db, ctx, input);
  const { config, teamMappings, ...columns } = input;
  await deps.db.transaction(async (tx) => {
    await tx
      .update(authProviders)
      .set({
        ...columns,
        ...(teamMappings ? { groupMappings: teamMappings } : {}),
        ...(config
          ? { configEncrypted: sealConfig(deps.secrets, id, mergeConfig(before.config, config)) }
          : {}),
        // A changed configuration has not been tested yet.
        ...(config ? { lastTest: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(authProviders.id, id));
    const after = await loadProvider(tx, deps.secrets, id);
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'sso.provider_updated',
      target: { kind: 'auth_provider', id },
      before: presentProvider(before, deps.publicUrl),
      after: presentProvider(after, deps.publicUrl),
      meta: ctx,
    });
  });
  forgetOidcDiscovery();
  return presentProvider(await loadProvider(deps.db, deps.secrets, id), deps.publicUrl);
}

/** People keep their accounts; only the sign-in links through this provider go. */
export async function deleteSsoProvider(
  deps: Deps,
  ctx: RequestContext,
  id: string,
): Promise<void> {
  await ctx.authz.authorize(ctx.actor, CONFIGURE, { kind: 'workspace' });
  const before = loadedOf(deps.secrets, await findProviderRow(deps.db, id));
  await assertNotLastWhileRequired(deps.db, before);
  await deps.db.transaction(async (tx) => {
    const unlinked = await tx
      .delete(authIdentities)
      .where(eq(authIdentities.providerId, id))
      .returning({ id: authIdentities.id });
    await tx.delete(authProviders).where(eq(authProviders.id, id));
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'sso.provider_deleted',
      target: { kind: 'auth_provider', id },
      before: presentProvider(before, deps.publicUrl),
      after: { identitiesUnlinked: unlinked.length },
      meta: ctx,
    });
  });
  forgetOidcDiscovery();
}
