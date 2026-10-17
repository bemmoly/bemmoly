import { z } from 'zod';
import type { GcpHttp } from './http.ts';

/*
 * Cloud Monitoring v3 time series for one Cloud Run revision. Cloud Run reports these
 * without any instrumentation in the application, which is why canary analysis can start
 * from them on day one.
 */

const BASE = 'https://monitoring.googleapis.com/v3';

const valueSchema = z.object({
  int64Value: z.union([z.string(), z.number()]).optional(),
  doubleValue: z.number().optional(),
});

const seriesSchema = z.object({
  metric: z
    .object({ labels: z.record(z.string(), z.string()).default({}) })
    .default({ labels: {} }),
  points: z
    .array(z.object({ interval: z.object({ endTime: z.string() }), value: valueSchema }))
    .default([]),
});

const listSchema = z.object({
  timeSeries: z.array(seriesSchema).default([]),
  nextPageToken: z.string().optional(),
});

export interface MonitoringPoint {
  at: Date;
  value: number;
}

export interface MonitoringSeries {
  labels: Readonly<Record<string, string>>;
  points: MonitoringPoint[];
}

const numberOf = (value: z.infer<typeof valueSchema>) =>
  value.doubleValue ?? (value.int64Value === undefined ? 0 : Number(value.int64Value));

export interface RevisionQuery {
  projectId: string;
  service: string;
  revision: string;
  from: Date;
  to: Date;
}

const revisionFilter = (metric: string, query: RevisionQuery) =>
  [
    `metric.type="run.googleapis.com/${metric}"`,
    'resource.type="cloud_run_revision"',
    `resource.label.service_name="${query.service}"`,
    `resource.label.revision_name="${query.revision}"`,
  ].join(' AND ');

export function createMonitoringClient(http: GcpHttp) {
  async function list(projectId: string, query: Record<string, string>) {
    const series: MonitoringSeries[] = [];
    let pageToken: string | undefined;
    do {
      const page = await http.send({
        url: `${BASE}/projects/${projectId}/timeSeries`,
        query: { ...query, pageToken },
        schema: listSchema,
      });
      for (const entry of page.timeSeries) {
        series.push({
          labels: entry.metric.labels,
          points: entry.points.map((point) => ({
            at: new Date(point.interval.endTime),
            value: numberOf(point.value),
          })),
        });
      }
      pageToken = page.nextPageToken || undefined;
    } while (pageToken);
    return series;
  }

  const window = (query: RevisionQuery) => ({
    'interval.startTime': query.from.toISOString(),
    'interval.endTime': query.to.toISOString(),
    'aggregation.alignmentPeriod': '60s',
  });

  return {
    /** Requests per minute, one series per response code class ("2xx", "5xx"). */
    requestCounts(query: RevisionQuery): Promise<MonitoringSeries[]> {
      return list(query.projectId, {
        filter: revisionFilter('request_count', query),
        ...window(query),
        'aggregation.perSeriesAligner': 'ALIGN_DELTA',
        'aggregation.crossSeriesReducer': 'REDUCE_SUM',
        'aggregation.groupByFields': 'metric.label.response_code_class',
      });
    },

    /** The 95th percentile of request latency per minute, in milliseconds. */
    latencyP95(query: RevisionQuery): Promise<MonitoringSeries[]> {
      return list(query.projectId, {
        filter: revisionFilter('request_latencies', query),
        ...window(query),
        'aggregation.perSeriesAligner': 'ALIGN_PERCENTILE_95',
        'aggregation.crossSeriesReducer': 'REDUCE_MAX',
      });
    },

    /** The latest remaining budget fraction of an SLO, or null when there are no points. */
    async sloBudgetFraction(projectId: string, slo: string, at: Date): Promise<number | null> {
      const series = await list(projectId, {
        filter: `select_slo_budget_fraction("${slo}")`,
        'interval.startTime': new Date(at.getTime() - 60 * 60_000).toISOString(),
        'interval.endTime': at.toISOString(),
      });
      const points = series.flatMap((entry) => entry.points);
      points.sort((a, b) => b.at.getTime() - a.at.getTime());
      return points[0]?.value ?? null;
    },
  };
}

export type MonitoringClient = ReturnType<typeof createMonitoringClient>;
