import type { RequestContext, SqlClient } from '@bemmoly/core';
import { ConflictError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type {
  CiIssuer,
  CiToken,
  CreateCiIssuerBody,
  CreateCiTokenBody,
  CreatedCiToken,
  CreateTrustRuleBody,
  TrustRule,
} from '../../../../shared/ci.ts';
import type { ApplicationRef } from '../../../../shared/catalog.ts';
import type { CiIssuerRow, CiTokenRow, TrustRuleRow } from '../../models/ci.ts';
import { isoOrNull, iso } from '../../utils/time.ts';
import { requirePerson } from '../deps.ts';
import type { AccessEngine } from '../access/engine.ts';
import { newCiToken } from './principal.ts';

/*
 * Platform › CI: the issuers Pipelines trusts, the trust rules that map a repository's
 * workflows to applications, and CI tokens for systems without OIDC. Issuers and rules that
 * cover a whole repository need a Platform admin; a rule or token naming applications needs
 * Maintainer on each of them.
 */

async function applications(sql: SqlClient, keys: readonly string[]) {
  if (keys.length === 0) return [];
  const rows = await sql<{ id: string; key: string; name: string; tier: number }[]>`
    select id, key, name, tier from pipeline_applications where key = any(${keys}) and archived_at is null`;
  const missing = keys.filter((key) => !rows.some((row) => row.key === key));
  if (missing.length > 0) throw new NotFoundError(`No application called "${missing[0]}"`);
  return rows;
}

async function refsByIds(
  sql: SqlClient,
  ids: readonly string[],
): Promise<Map<string, ApplicationRef>> {
  if (ids.length === 0) return new Map();
  const rows = await sql<{ id: string; key: string; name: string; tier: number }[]>`
    select id, key, name, tier from pipeline_applications where id = any(${ids}::uuid[])`;
  return new Map(rows.map((row) => [row.id, { ...row, tier: row.tier as 0 | 1 | 2 }]));
}

const toIssuer = (row: CiIssuerRow): CiIssuer => ({
  id: row.id,
  key: row.key,
  name: row.name,
  kind: row.kind,
  issuer: row.issuer,
  discoveryUrl: row.discovery_url,
  audience: row.audience,
  claimMapping: row.claim_mapping,
  enabled: row.enabled,
  ruleCount: row.rule_count ?? 0,
});

export function createCiAdmin(sql: () => SqlClient, access: AccessEngine) {
  async function authorizeApps(ctx: RequestContext, ids: readonly string[]) {
    if (ids.length === 0) {
      await access.authorizeAction(ctx, 'platform', {});
      return;
    }
    for (const id of ids) await access.authorizeAction(ctx, 'manage', { application: id });
  }

  async function presentRules(rows: readonly TrustRuleRow[]): Promise<TrustRule[]> {
    const refs = await refsByIds(sql(), [...new Set(rows.flatMap((row) => row.application_ids))]);
    return rows.map((row) => ({
      id: row.id,
      issuer: { id: row.issuer_id, key: row.issuer_key, name: row.issuer_name },
      repository: row.repository,
      refs: row.refs,
      workflows: row.workflows,
      environments: row.environments,
      applications: row.application_ids.flatMap((id) => refs.get(id) ?? []),
      enabled: row.enabled,
      createdAt: iso(row.created_at),
    }));
  }

  async function presentTokens(rows: readonly CiTokenRow[]): Promise<CiToken[]> {
    const refs = await refsByIds(sql(), [...new Set(rows.flatMap((row) => row.application_ids))]);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      prefix: row.token_prefix,
      applications: row.application_ids.flatMap((id) => refs.get(id) ?? []),
      expiresAt: isoOrNull(row.expires_at),
      lastUsedAt: isoOrNull(row.last_used_at),
      revokedAt: isoOrNull(row.revoked_at),
      createdAt: iso(row.created_at),
    }));
  }

  const RULE_SELECT = `r.id, r.issuer_id, i.key as issuer_key, i.name as issuer_name, r.repository,
    r.refs, r.workflows, r.environments, r.application_ids, r.enabled, r.created_at
    from pipeline_ci_trust_rules r join pipeline_ci_issuers i on i.id = r.issuer_id`;

  return {
    async issuers(ctx: RequestContext): Promise<CiIssuer[]> {
      await access.authorizeAction(ctx, 'view', {});
      const rows = await sql()<CiIssuerRow[]>`
        select i.*, (select count(*) from pipeline_ci_trust_rules r where r.issuer_id = i.id)::int
          as rule_count
        from pipeline_ci_issuers i order by lower(i.name)`;
      return rows.map(toIssuer);
    },

    async createIssuer(ctx: RequestContext, body: CreateCiIssuerBody): Promise<CiIssuer> {
      await access.authorizeAction(ctx, 'platform', {});
      const issuer = body.issuer.replace(/\/+$/, '');
      const discovery = body.discoveryUrl ?? `${issuer}/.well-known/openid-configuration`;
      const rows = await sql()<CiIssuerRow[]>`
        insert into pipeline_ci_issuers
          (key, name, kind, issuer, discovery_url, audience, claim_mapping, created_by)
        values (${body.key}, ${body.name}, ${body.kind}, ${issuer}, ${discovery},
          ${body.audience ?? null}, ${JSON.stringify(body.claimMapping)}::jsonb,
          ${requirePerson(ctx.actor)}::uuid)
        on conflict do nothing returning *`;
      if (!rows[0]) throw new ConflictError('That issuer, or that key, is already trusted');
      return toIssuer(rows[0]);
    },

    async removeIssuer(ctx: RequestContext, id: string): Promise<void> {
      await access.authorizeAction(ctx, 'platform', {});
      const rows = await sql()`delete from pipeline_ci_issuers where id = ${id}::uuid returning id`;
      if (rows.length === 0) throw new NotFoundError('No such issuer');
    },

    async rules(ctx: RequestContext, application?: string): Promise<TrustRule[]> {
      await access.authorizeAction(ctx, 'view', {});
      const db = sql();
      const rows = await db<TrustRuleRow[]>`
        select ${db.unsafe(RULE_SELECT)}
        ${
          application
            ? db`where exists (select 1 from pipeline_applications a
                left join pipeline_repositories p on p.id = a.repository_id
                where a.key = ${application}
                  and (a.id = any(r.application_ids)
                    or (cardinality(r.application_ids) = 0 and lower(p.full_name) = lower(r.repository))))`
            : db``
        }
        order by lower(r.repository), r.created_at`;
      return presentRules(rows);
    },

    async createRule(ctx: RequestContext, body: CreateTrustRuleBody): Promise<TrustRule> {
      const apps = await applications(sql(), body.applications);
      await authorizeApps(
        ctx,
        apps.map((app) => app.id),
      );
      const [issuer] = await sql()<{ id: string }[]>`
        select id from pipeline_ci_issuers where key = ${body.issuer}`;
      if (!issuer) throw new NotFoundError(`No issuer called "${body.issuer}"`);
      if (body.refs.length === 0 && body.environments.length === 0 && apps.length === 0) {
        throw new ValidationError(
          'Name at least the refs or environments this repository may release from',
        );
      }
      const db = sql();
      const [row] = await db<{ id: string }[]>`
        insert into pipeline_ci_trust_rules
          (issuer_id, repository, refs, workflows, environments, application_ids, created_by)
        values (${issuer.id}::uuid, ${body.repository}, ${body.refs}, ${body.workflows},
          ${body.environments}, ${apps.map((app) => app.id)}::uuid[], ${requirePerson(ctx.actor)}::uuid)
        returning id`;
      const rows = await db<TrustRuleRow[]>`
        select ${db.unsafe(RULE_SELECT)} where r.id = ${row?.id ?? ''}::uuid`;
      return (await presentRules(rows))[0] as TrustRule;
    },

    async removeRule(ctx: RequestContext, id: string): Promise<void> {
      const [rule] = await sql()<{ application_ids: string[] }[]>`
        select application_ids from pipeline_ci_trust_rules where id = ${id}::uuid`;
      if (!rule) throw new NotFoundError('No such trust rule');
      await authorizeApps(ctx, rule.application_ids);
      await sql()`delete from pipeline_ci_trust_rules where id = ${id}::uuid`;
    },

    async tokens(ctx: RequestContext): Promise<CiToken[]> {
      await access.authorizeAction(ctx, 'view', {});
      const rows = await sql()<CiTokenRow[]>`
        select id, name, token_prefix, application_ids, expires_at, last_used_at, revoked_at,
          created_at
        from pipeline_ci_tokens order by revoked_at nulls first, created_at desc limit 200`;
      return presentTokens(rows);
    },

    async createToken(ctx: RequestContext, body: CreateCiTokenBody): Promise<CreatedCiToken> {
      const apps = await applications(sql(), body.applications);
      await authorizeApps(
        ctx,
        apps.map((app) => app.id),
      );
      const { token, prefix, hash } = newCiToken();
      const [row] = await sql()<CiTokenRow[]>`
        insert into pipeline_ci_tokens
          (name, token_prefix, token_hash, application_ids, expires_at, created_by)
        values (${body.name}, ${prefix}, ${hash}, ${apps.map((app) => app.id)}::uuid[],
          ${body.expiresAt ?? null}::timestamptz, ${requirePerson(ctx.actor)}::uuid)
        returning id, name, token_prefix, application_ids, expires_at, last_used_at, revoked_at,
          created_at`;
      const [presented] = await presentTokens(row ? [row] : []);
      return { ...(presented as CiToken), token };
    },

    async revokeToken(ctx: RequestContext, id: string): Promise<void> {
      const [row] = await sql()<{ application_ids: string[] }[]>`
        select application_ids from pipeline_ci_tokens where id = ${id}::uuid`;
      if (!row) throw new NotFoundError('No such CI token');
      await authorizeApps(ctx, row.application_ids);
      await sql()`update pipeline_ci_tokens set revoked_at = coalesce(revoked_at, now()),
        updated_at = now() where id = ${id}::uuid`;
    },
  };
}
