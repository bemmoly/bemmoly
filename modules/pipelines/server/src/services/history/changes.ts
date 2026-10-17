import type { SqlExecutor } from '@bemmoly/core';
import type { z } from 'zod';
import type {
  ChangeItem,
  ChangeKind,
  changesQuerySchema,
  ErrorSeries,
} from '../../../../shared/changes.ts';
import type { EnvironmentClass, Tier } from '../../../../shared/common.ts';
import { iso } from '../../utils/time.ts';

/*
 * What changed? (architecture §18): every deploy, roll back, config, environment, access,
 * policy and infrastructure change in a scope and window, newest first, one indexed read.
 * A change that landed in the hour before the error rate rose is marked with how long
 * before; the product says nothing more than the timing does.
 */

export type ParsedChangesQuery = z.output<typeof changesQuerySchema>;

const WINDOWS = { '1h': 1, '3h': 3, '24h': 24, '7d': 168 } as const;
const HOUR = 3_600_000;
const BEFORE_RISE_MS = HOUR;

export function windowOf(query: ParsedChangesQuery, now: Date): { from: Date; to: Date } {
  const to = query.to ? new Date(query.to) : now;
  const hours = WINDOWS[query.window];
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - hours * HOUR);
  return { from, to };
}

interface Row {
  id: string;
  kind: string;
  occurred_at: string;
  application_id: string | null;
  application_key: string | null;
  application_name: string | null;
  tier: number | null;
  environment_id: string | null;
  environment_key: string | null;
  environment_name: string | null;
  environment_class: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_label: string | null;
  summary: string;
  detail: string | null;
  revertible: boolean;
  ref_kind: string | null;
  ref_id: string | null;
}

export async function listChanges(
  sql: SqlExecutor,
  input: {
    domain: string | null;
    group: string | null;
    from: Date;
    to: Date;
    kinds: readonly ChangeKind[] | undefined;
    prodOnly: boolean;
    includeCallersOf: string | undefined;
  },
): Promise<Row[]> {
  const callers = input.includeCallersOf
    ? sql`or ch.application_id in (
        select dep.application_id from pipeline_application_dependencies dep
        join pipeline_applications target on target.id = dep.depends_on_id
        where target.key = ${input.includeCallersOf})`
    : sql``;
  const scoped =
    input.domain || input.group
      ? sql`and ((true
          ${input.domain ? sql`and d.key = ${input.domain}` : sql``}
          ${input.group ? sql`and g.key = ${input.group}` : sql``}) ${callers})`
      : sql``;
  return sql<Row[]>`
    select ch.id, ch.kind, ch.occurred_at, a.id as application_id, a.key as application_key,
      a.name as application_name, a.tier, e.id as environment_id, e.key as environment_key,
      e.name as environment_name, e.class as environment_class, ch.actor_user_id,
      u.name as actor_name, ch.actor_label, ch.summary, ch.detail, ch.revertible, ch.ref_kind,
      ch.ref_id
    from pipeline_changes ch
    left join pipeline_applications a on a.id = ch.application_id
    left join pipeline_environments e on e.id = ch.environment_id
    left join pipeline_domains d on d.id = ch.domain_id
    left join pipeline_groups g on g.id = ch.group_id
    left join users u on u.id = ch.actor_user_id
    where ch.occurred_at >= ${input.from.toISOString()}::timestamptz
      and ch.occurred_at <= ${input.to.toISOString()}::timestamptz
      ${input.kinds?.length ? sql`and ch.kind = any(${input.kinds as string[]}::text[])` : sql``}
      ${input.prodOnly ? sql`and e.class = 'prod'` : sql``}
      ${scoped}
    order by ch.occurred_at desc, ch.id desc
    limit 500`;
}

export function toChangeItem(row: Row, series: ErrorSeries): ChangeItem {
  const at = new Date(row.occurred_at).getTime();
  const rise = series.riseAt ? new Date(series.riseAt).getTime() : null;
  const before = rise !== null && at <= rise && rise - at <= BEFORE_RISE_MS;
  return {
    id: row.id,
    kind: row.kind as ChangeKind,
    occurredAt: iso(row.occurred_at),
    application:
      row.application_id && row.application_key && row.application_name
        ? {
            id: row.application_id,
            key: row.application_key,
            name: row.application_name,
            tier: (row.tier ?? 2) as Tier,
          }
        : null,
    environment:
      row.environment_id && row.environment_key && row.environment_name
        ? {
            id: row.environment_id,
            key: row.environment_key,
            name: row.environment_name,
            class: (row.environment_class ?? 'dev') as EnvironmentClass,
          }
        : null,
    actor:
      row.actor_user_id && row.actor_name
        ? { id: row.actor_user_id, name: row.actor_name, avatarUrl: null }
        : null,
    actorLabel: row.actor_label ?? (row.actor_user_id ? null : 'Platform'),
    summary: row.summary,
    detail: row.detail,
    revertible: row.revertible,
    ref: row.ref_kind && row.ref_id ? { kind: row.ref_kind, id: row.ref_id } : null,
    beforeRiseMinutes: before && rise !== null ? Math.round((rise - at) / 60_000) : null,
  };
}
