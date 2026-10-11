#!/usr/bin/env node
/**
 * The server's own view of a run: p50, p95 and p99 per route between two /metrics scrapes
 * (taken before and after a k6 script), from the latency histogram. Next to k6's numbers it
 * separates time in the server from time on the path to it (proxies, port forwards).
 *
 *   node perf/src/server-latency.ts --before before.prom --after after.prom [--min 20]
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parseProm, buckets, windowQuantile, type Sample } from './soak/prom.ts';

const HISTOGRAM_COUNT = 'bemmoly_http_request_duration_seconds_count';

export interface RouteLatency {
  method: string;
  route: string;
  count: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
}

export function routeLatencies(before: Sample[], after: Sample[], minimum = 1): RouteLatency[] {
  const routes = new Map<string, { method: string; route: string }>();
  for (const s of after) {
    if (s.name !== HISTOGRAM_COUNT) continue;
    const method = s.labels['method'] ?? '';
    const route = s.labels['route'] ?? '';
    routes.set(`${method} ${route}`, { method, route });
  }
  const out: RouteLatency[] = [];
  for (const { method, route } of routes.values()) {
    const where = (labels: Record<string, string>) =>
      labels['method'] === method && labels['route'] === route;
    const count = (samples: Sample[]) =>
      samples
        .filter((s) => s.name === HISTOGRAM_COUNT && where(s.labels))
        .reduce((t, s) => t + s.value, 0);
    const n = count(after) - count(before);
    if (n < minimum) continue;
    const [b, a] = [buckets(before, where), buckets(after, where)];
    const q = (quantile: number) => {
      const value = windowQuantile(b, a, quantile);
      return value === null ? null : Math.round(value * 10) / 10;
    };
    out.push({ method, route, count: n, p50: q(0.5), p95: q(0.95), p99: q(0.99) });
  }
  return out.sort((x, y) => y.count - x.count);
}

function main() {
  const { values } = parseArgs({
    options: {
      before: { type: 'string' },
      after: { type: 'string' },
      min: { type: 'string', default: '20' },
    },
  });
  if (!values.before || !values.after) throw new Error('--before and --after are required');
  const rows = routeLatencies(
    parseProm(readFileSync(values.before, 'utf8')),
    parseProm(readFileSync(values.after, 'utf8')),
    Number(values.min),
  );
  const fmt = (value: number | null) => (value === null ? '-' : value.toFixed(1));
  const lines = [
    '| Route | Requests | p50 ms | p95 ms | p99 ms |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows.map(
      (r) =>
        `| ${r.method} ${r.route} | ${r.count} | ${fmt(r.p50)} | ${fmt(r.p95)} | ${fmt(r.p99)} |`,
    ),
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

if (import.meta.main) main();
