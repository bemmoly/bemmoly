import type { SqlExecutor } from '@bemmoly/core';
import { decodeCursor, toPage } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { DeploymentState, EnvironmentClass, Tier } from '../../../../../shared/common.ts';
import type {
  CanaryAnalysis,
  CanaryVerdict,
  Deployment,
  DeploymentDetail,
  DeploymentKind,
  DeploymentPhase,
  DeploymentsPage,
  ListDeploymentsQuery,
} from '../../../../../shared/deployments.ts';
import { iso, isoOrNull } from '../../../utils/time.ts';

/* Deployments as the API shows them: lists, one with its events, and its canary evidence. */

interface Row {
  id: string;
  promotion_id: string | null;
  release_id: string;
  version: string;
  application_id: string;
  application_key: string;
  application_name: string;
  tier: number;
  environment_id: string;
  environment_key: string;
  environment_name: string;
  environment_class: string;
  kind: string;
  wave: number;
  state: string;
  phase: string;
  traffic_percent: number;
  revision: string | null;
  previous_release_id: string | null;
  previous_version: string | null;
  previous_revision: string | null;
  rollback_of_id: string | null;
  pause_reason: string | null;
  reason: string | null;
  started_by: string | null;
  started_by_name: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  failing_samples: number;
}

const SELECT = `d.id, d.promotion_id, d.release_id, r.version, d.application_id,
  a.key as application_key, a.name as application_name, a.tier, d.environment_id,
  e.key as environment_key, e.name as environment_name, e.class as environment_class, d.kind,
  d.wave, d.state, d.phase, d.traffic_percent, d.revision, d.previous_release_id,
  p.version as previous_version, d.previous_revision, d.rollback_of_id, d.pause_reason, d.reason,
  d.started_by, u.name as started_by_name, d.started_at, d.finished_at, d.created_at,
  d.failing_samples
  from pipeline_deployments d
  join pipeline_releases r on r.id = d.release_id
  join pipeline_applications a on a.id = d.application_id
  join pipeline_environments e on e.id = d.environment_id
  left join pipeline_releases p on p.id = d.previous_release_id
  left join users u on u.id = d.started_by`;

const toDeployment = (row: Row): Deployment => ({
  id: row.id,
  promotionId: row.promotion_id,
  release: { id: row.release_id, version: row.version },
  application: {
    id: row.application_id,
    key: row.application_key,
    name: row.application_name,
    tier: row.tier as Tier,
  },
  environment: {
    id: row.environment_id,
    key: row.environment_key,
    name: row.environment_name,
    class: row.environment_class as EnvironmentClass,
  },
  kind: row.kind as DeploymentKind,
  wave: row.wave,
  state: row.state as DeploymentState,
  trafficPercent: row.traffic_percent,
  revision: row.revision,
  previous:
    row.previous_release_id && row.previous_version
      ? {
          releaseId: row.previous_release_id,
          version: row.previous_version,
          revision: row.previous_revision,
        }
      : null,
  rollbackOfId: row.rollback_of_id,
  phase: row.phase as DeploymentPhase,
  pauseReason: row.pause_reason,
  reason: row.reason,
  startedBy:
    row.started_by && row.started_by_name
      ? { id: row.started_by, name: row.started_by_name, avatarUrl: null }
      : null,
  startedAt: isoOrNull(row.started_at),
  finishedAt: isoOrNull(row.finished_at),
  createdAt: iso(row.created_at),
});

export async function listDeployments(
  sql: SqlExecutor,
  query: ListDeploymentsQuery,
): Promise<DeploymentsPage> {
  const after = decodeCursor(query.cursor);
  const rows = await sql<Row[]>`
    select ${sql.unsafe(SELECT)}
    where true
      ${query.application ? sql`and a.key = ${query.application}` : sql``}
      ${query.environment ? sql`and e.key = ${query.environment}` : sql``}
      ${query.state ? sql`and d.state = ${query.state}` : sql``}
      ${query.kind ? sql`and d.kind = ${query.kind}` : sql``}
      ${after ? sql`and d.id < ${after}::uuid` : sql``}
    order by d.id desc limit ${query.limit + 1}`;
  const page = toPage(rows, query.limit);
  return { items: page.rows.map(toDeployment), nextCursor: page.nextCursor };
}

export async function getDeploymentRow(sql: SqlExecutor, id: string): Promise<Row> {
  const [row] = await sql<Row[]>`select ${sql.unsafe(SELECT)} where d.id = ${id}`;
  if (!row) throw new NotFoundError('That deployment does not exist');
  return row;
}

export async function getDeployment(sql: SqlExecutor, id: string): Promise<DeploymentDetail> {
  const row = await getDeploymentRow(sql, id);
  const events = await sql<
    {
      id: string;
      state: string;
      traffic_percent: number;
      message: string | null;
      data: Record<string, unknown>;
      occurred_at: string;
    }[]
  >`
    select id, state, traffic_percent, message, data, occurred_at from pipeline_deployment_events
    where deployment_id = ${id} order by occurred_at, id`;
  return {
    ...toDeployment(row),
    events: events.map((event) => ({
      id: event.id,
      deploymentId: id,
      state: event.state,
      trafficPercent: event.traffic_percent,
      message: event.message,
      data: event.data,
      occurredAt: iso(event.occurred_at),
    })),
  };
}

export async function canaryAnalysis(
  sql: SqlExecutor,
  id: string,
  hasMetrics: boolean,
): Promise<CanaryAnalysis> {
  const row = await getDeploymentRow(sql, id);
  const samples = await sql<
    {
      step_index: number;
      phase: 'step' | 'watch';
      traffic_percent: number;
      metric: 'error_rate' | 'latency_p95';
      canary_value: number | null;
      stable_value: number | null;
      canary_requests: number;
      verdict: CanaryVerdict;
      sampled_at: string;
    }[]
  >`
    select step_index, phase, traffic_percent, metric, canary_value, stable_value,
      canary_requests, verdict, sampled_at
    from pipeline_canary_samples where deployment_id = ${id} order by sampled_at, metric`;
  const metrics = (['error_rate', 'latency_p95'] as const).map((metric) => {
    const series = samples.filter((sample) => sample.metric === metric);
    const last = series.at(-1);
    // Error rates are stored as fractions and shown in percent, as the chart labels them.
    const scale = metric === 'error_rate' ? 100 : 1;
    const shown = (value: number | null | undefined) =>
      value === null || value === undefined ? null : value * scale;
    const point = (value: number | null, at: string): [string, number][] =>
      value === null ? [] : [[iso(at), value * scale]];
    return {
      metric,
      unit: metric === 'error_rate' ? '%' : 'ms',
      stable: {
        value: shown(last?.stable_value),
        series: series.flatMap((s) => point(s.stable_value, s.sampled_at)),
      },
      canary: {
        value: shown(last?.canary_value),
        series: series.flatMap((s) => point(s.canary_value, s.sampled_at)),
      },
      verdict: last?.verdict ?? 'pending',
    };
  });
  const verdicts = metrics.map((metric) => metric.verdict);
  const verdict: CanaryVerdict = verdicts.includes('fail')
    ? 'fail'
    : verdicts.includes('marginal')
      ? 'marginal'
      : verdicts.every((v) => v === 'pass')
        ? 'pass'
        : 'pending';
  return {
    deploymentId: id,
    environment: {
      id: row.environment_id,
      key: row.environment_key,
      name: row.environment_name,
      class: row.environment_class as EnvironmentClass,
    },
    trafficPercent: row.traffic_percent,
    metrics,
    source: hasMetrics ? 'metrics' : 'unavailable',
    failingSamples: row.failing_samples,
    verdict,
    phase: row.phase as DeploymentPhase,
    samples: samples.map((s) => ({
      stepIndex: s.step_index,
      phase: s.phase,
      trafficPercent: s.traffic_percent,
      metric: s.metric,
      canary: s.canary_value,
      stable: s.stable_value,
      requests: s.canary_requests,
      verdict: s.verdict,
      sampledAt: iso(s.sampled_at),
    })),
  };
}
