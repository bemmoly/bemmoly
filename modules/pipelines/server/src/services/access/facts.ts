import type { SqlClient } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import {
  policyRequirementsSchema,
  roleSchema,
  type PolicyRequirements,
} from '../../../../shared/access.ts';
import { environmentClassSchema, type EnvironmentClass } from '../../../../shared/common.ts';
import type {
  BindingRow,
  EnvironmentFactRow,
  FreezeRow,
  PolicyRow,
  ScopeRow,
  TargetRow,
} from '../../models/access.ts';
import type {
  AccessFacts,
  AccessTarget,
  ApplicationFacts,
  BindingFact,
  EnvironmentFacts,
  PersonFacts,
  PolicyFact,
  ScopeNode,
} from './types.ts';

/*
 * Loading what one decision needs. Everything here depends only on rows the access stamp
 * watches, except the clock, so the result (minus `now`) is safe to cache under the stamp.
 * Freezes are loaded with their start and end and filtered by the clock at decision time.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

export interface TimedFreeze {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  environmentClass: EnvironmentClass | null;
}

/** Facts without the clock: what the per-process cache keeps. */
export type CachedFacts = Omit<AccessFacts, 'now' | 'freezes'> & { freezes: TimedFreeze[] };

export interface ResolvedTarget {
  path: ScopeNode[];
  application: ApplicationFacts | null;
  environment: EnvironmentFacts | null;
  owner: { id: string; name: string } | null;
}

const envClass = (value: string | null): EnvironmentClass | null =>
  value === null ? null : environmentClassSchema.parse(value);

async function resolveApplication(sql: SqlClient, ref: string, root: ScopeNode) {
  const [row] = await sql<TargetRow[]>`
    select a.id, a.key, a.name, a.tier, a.labels, a.lifecycle, a.runtime,
      d.id as domain_id, d.key as domain_key, d.name as domain_name,
      g.id as group_id, g.key as group_key, g.name as group_name,
      t.id as owner_id, t.name as owner_name
    from pipeline_applications a
      join pipeline_domains d on d.id = a.domain_id
      join pipeline_groups g on g.id = a.group_id
      left join teams t on t.id = a.owner_team_id
    where ${isUuid(ref) ? sql`a.id = ${ref}::uuid` : sql`a.key = ${ref}`}`;
  if (!row) throw new NotFoundError(`No application called "${ref}"`);
  const path: ScopeNode[] = [
    root,
    { kind: 'domain', id: row.domain_id, key: row.domain_key, name: row.domain_name },
    { kind: 'group', id: row.group_id, key: row.group_key, name: row.group_name },
    { kind: 'application', id: row.id, key: row.key, name: row.name },
  ];
  const application: ApplicationFacts = {
    id: row.id,
    key: row.key,
    name: row.name,
    tier: row.tier,
    labels: row.labels,
    lifecycle: row.lifecycle,
    runtime: row.runtime,
    domainKey: row.domain_key,
    groupKey: row.group_key,
  };
  const owner = row.owner_id ? { id: row.owner_id, name: row.owner_name ?? '' } : null;
  return { path, application, owner };
}

async function resolveScope(sql: SqlClient, target: AccessTarget, root: ScopeNode) {
  const scope = target.scope;
  if (!scope || scope.kind === 'organisation' || !scope.id) return [root];
  if (scope.kind === 'application') return (await resolveApplication(sql, scope.id, root)).path;
  const [row] = await sql<ScopeRow[]>`
    ${
      scope.kind === 'domain'
        ? sql`select d.id as domain_id, d.key as domain_key, d.name as domain_name,
              null::uuid as group_id, null::text as group_key, null::text as group_name
            from pipeline_domains d where d.id = ${scope.id}::uuid`
        : sql`select d.id as domain_id, d.key as domain_key, d.name as domain_name,
              g.id as group_id, g.key as group_key, g.name as group_name
            from pipeline_groups g join pipeline_domains d on d.id = g.domain_id
            where g.id = ${scope.id}::uuid`
    }`;
  if (!row) throw new NotFoundError(`No ${scope.kind} with that id`);
  const path: ScopeNode[] = [
    root,
    { kind: 'domain', id: row.domain_id, key: row.domain_key, name: row.domain_name },
  ];
  if (row.group_id) {
    path.push({
      kind: 'group',
      id: row.group_id,
      key: row.group_key ?? '',
      name: row.group_name ?? '',
    });
  }
  return path;
}

async function resolveEnvironment(sql: SqlClient, ref: string): Promise<EnvironmentFacts> {
  const [row] = await sql<EnvironmentFactRow[]>`
    select id, key, name, class, region, protection from pipeline_environments
    where ${isUuid(ref) ? sql`id = ${ref}::uuid` : sql`key = ${ref}`}`;
  if (!row) throw new NotFoundError(`No environment called "${ref}"`);
  const cls = environmentClassSchema.parse(row.class);
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    class: cls,
    // Prod is protected unless an admin explicitly says otherwise.
    protected: row.protection?.protected ?? cls === 'prod',
    region: row.region,
    window: row.protection?.window ?? null,
  };
}

export async function resolveTarget(
  sql: SqlClient,
  target: AccessTarget,
  root: ScopeNode,
): Promise<ResolvedTarget> {
  const environment = target.environment ? await resolveEnvironment(sql, target.environment) : null;
  if (target.application) {
    return { ...(await resolveApplication(sql, target.application, root)), environment };
  }
  return {
    path: await resolveScope(sql, target, root),
    application: null,
    environment,
    owner: null,
  };
}

export async function loadPerson(
  sql: SqlClient,
  userId: string,
): Promise<Omit<PersonFacts, 'orgAdmin'>> {
  const [person] = await sql<{ name: string }[]>`select name from users where id = ${userId}::uuid`;
  if (!person) throw new NotFoundError('No such person');
  const teams = await sql<{ id: string; name: string }[]>`
    select t.id, t.name from team_members m join teams t on t.id = m.team_id
    where m.user_id = ${userId}::uuid order by lower(t.name)`;
  return { id: userId, name: person.name, teams: [...teams] };
}

/** Bindings, policies and freezes at any scope on the path. */
function onPath(sql: SqlClient, path: readonly ScopeNode[], alias: string) {
  const conditions = path.map((node) =>
    node.kind === 'organisation'
      ? sql`${sql(alias)}.scope_kind = 'organisation'`
      : sql`(${sql(alias)}.scope_kind = ${node.kind} and ${sql(alias)}.scope_id = ${node.id}::uuid)`,
  );
  return conditions.reduce((all, condition) => sql`${all} or ${condition}`);
}

export function scopeOf(
  kind: string,
  id: string | null,
  path: readonly ScopeNode[],
  fallback: { key: string | null; name: string | null } = { key: null, name: null },
): ScopeNode {
  const known = path.find((node) => node.kind === kind && node.id === id);
  if (known) return known;
  return {
    kind: kind as ScopeNode['kind'],
    id,
    key: fallback.key ?? '',
    name: fallback.name ?? '',
  };
}

export const BINDING_COLUMNS = `
  b.id, b.subject_kind, b.subject_id,
  coalesce(t.name, u.name) as subject_name, null::text as subject_avatar,
  b.role, b.scope_kind, b.scope_id,
  coalesce(d.key, g.key, a.key) as scope_key, coalesce(d.name, g.name, a.name) as scope_name,
  b.environment_class, b.expires_at, b.reason, b.created_by, cu.name as created_by_name,
  b.created_at`;

export const BINDING_FROM = `
  pipeline_role_bindings b
    left join teams t on b.subject_kind = 'team' and t.id = b.subject_id
    left join users u on b.subject_kind = 'user' and u.id = b.subject_id
    left join pipeline_domains d on b.scope_kind = 'domain' and d.id = b.scope_id
    left join pipeline_groups g on b.scope_kind = 'group' and g.id = b.scope_id
    left join pipeline_applications a on b.scope_kind = 'application' and a.id = b.scope_id
    left join users cu on cu.id = b.created_by`;

export function toBindingFact(row: BindingRow, path: readonly ScopeNode[]): BindingFact {
  return {
    id: row.id,
    subject: { kind: row.subject_kind, id: row.subject_id, name: row.subject_name ?? 'Someone' },
    role: roleSchema.parse(row.role),
    scope: scopeOf(row.scope_kind, row.scope_id, path, {
      key: row.scope_key,
      name: row.scope_name,
    }),
    environmentClass: envClass(row.environment_class),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    reason: row.reason,
  };
}

/** Requirements as stored; a row written by an older shape still reads, with defaults. */
export function readRequirements(value: unknown): PolicyRequirements {
  const parsed = policyRequirementsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : policyRequirementsSchema.parse({});
}

export async function loadPathFacts(sql: SqlClient, path: readonly ScopeNode[]) {
  const [bindings, policies, freezes] = await Promise.all([
    sql<BindingRow[]>`
      select ${sql.unsafe(BINDING_COLUMNS)} from ${sql.unsafe(BINDING_FROM)}
      where (${onPath(sql, path, 'b')})
        and (b.expires_at is null or b.expires_at > now())`,
    sql<PolicyRow[]>`
      select p.id, p.key, p.name, p.scope_kind, p.scope_id, null as scope_name,
        p.current_version, p.enabled, p.source_repository, p.updated_at,
        v.applies, v.requirements, v.sentence, v.source
      from pipeline_policies p
        join pipeline_policy_versions v on v.policy_id = p.id and v.version = p.current_version
      where p.enabled and (${onPath(sql, path, 'p')})
      order by p.key`,
    sql<FreezeRow[]>`
      select f.id, f.name, f.starts_at, f.ends_at, f.environment_class from pipeline_freezes f
      where f.ends_at > now() and (${onPath(sql, path, 'f')})`,
  ]);
  return {
    bindings: bindings.map((row) => toBindingFact(row, path)),
    policies: policies.map((row): PolicyFact => ({
      id: row.id,
      key: row.key,
      name: row.name,
      version: row.current_version,
      scope: scopeOf(row.scope_kind, row.scope_id, path),
      applies: row.applies,
      requirements: readRequirements(row.requirements),
      sentence: row.sentence,
    })),
    freezes: freezes.map((row): TimedFreeze => ({
      id: row.id,
      name: row.name,
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
      environmentClass: envClass(row.environment_class),
    })),
  };
}

/** The cached facts at a moment: only freezes in force then, for the target's environment. */
export function atTime(cached: CachedFacts, now: Date): AccessFacts {
  const env = cached.environment?.class;
  const freezes = cached.freezes
    .filter((f) => f.startsAt.getTime() <= now.getTime() && f.endsAt.getTime() > now.getTime())
    .filter((f) => !f.environmentClass || f.environmentClass === env)
    .map(({ id, name, endsAt, environmentClass }) => ({ id, name, endsAt, environmentClass }));
  return { ...cached, freezes, now };
}
