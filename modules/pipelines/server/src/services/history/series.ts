import type { SqlExecutor } from '@bemmoly/core';
import type { ErrorSeries } from '../../../../shared/changes.ts';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { resolveTarget } from '../shipping/targets.ts';

/*
 * The error rate over What changed?'s window: the revisions running in Prod in the scope,
 * read from their providers and averaged per minute. When no provider has metrics for any
 * of them the series says "unavailable" and the chart says so, rather than drawing a flat
 * line nobody measured. The rise is found by timing alone: the first sustained step above
 * twice the window's opening level.
 */

const MAX_TARGETS = 20;
const MINUTE = 60_000;

export async function scopeErrorSeries(
  sql: SqlExecutor,
  providers: ProviderSourceOrRegistry,
  input: { domain: string | null; group: string | null; from: Date; to: Date; label: string },
): Promise<ErrorSeries> {
  const targets = await sql<{ application_id: string; environment_id: string; revision: string }[]>`
    select c.application_id, c.environment_id, dep.revision
    from pipeline_current c
    join pipeline_environments e on e.id = c.environment_id and e.class = 'prod'
    join pipeline_applications a on a.id = c.application_id
    join pipeline_domains d on d.id = a.domain_id
    join pipeline_groups g on g.id = a.group_id
    join pipeline_deployments dep on dep.id = c.deployment_id and dep.revision is not null
    where true
      ${input.domain ? sql`and d.key = ${input.domain}` : sql``}
      ${input.group ? sql`and g.key = ${input.group}` : sql``}
    order by c.deployed_at desc nulls last limit ${MAX_TARGETS}`;
  const buckets = new Map<number, number[]>();
  for (const row of targets) {
    try {
      const { provider, target } = await resolveTarget(
        sql,
        providers,
        row.application_id,
        row.environment_id,
      );
      const series = await provider.metrics?.revision(target, row.revision, 'error_rate', input);
      for (const [at, value] of series?.points ?? []) {
        const minute = Math.floor(at.getTime() / MINUTE) * MINUTE;
        buckets.set(minute, [...(buckets.get(minute) ?? []), value]);
      }
    } catch {
      // A target whose provider cannot answer adds nothing; the others still draw.
    }
  }
  const points = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([at, values]): [string, number] => [
      new Date(at).toISOString(),
      (values.reduce((sum, v) => sum + v, 0) / values.length) * 100,
    ]);
  return {
    label: input.label,
    source: points.length > 0 ? 'metrics' : 'unavailable',
    points,
    riseAt: riseOf(points),
  };
}

/** The first point of a rise that holds for two points, above twice the opening level. */
export function riseOf(points: ReadonlyArray<readonly [string, number]>): string | null {
  if (points.length < 4) return null;
  const opening = points.slice(0, Math.max(2, Math.floor(points.length / 4))).map(([, v]) => v);
  const level = [...opening].sort((a, b) => a - b)[Math.floor(opening.length / 2)] ?? 0;
  const threshold = Math.max(level * 2, level + 1);
  for (let i = 0; i < points.length - 1; i += 1) {
    const now = points[i];
    const next = points[i + 1];
    if (now && next && now[1] > threshold && next[1] > threshold) return now[0];
  }
  return null;
}
