#!/usr/bin/env node
/**
 * Reads a concurrency ramp (perf/run-ramp.sh's output directory) and says where the install
 * stops keeping its §20 budgets: per step, the server's p95 and p99 per route, the error rate,
 * CPU, memory, pool use, queue depth and keystroke echo, then the limit (the highest step
 * with every budgeted route inside its budget and under 0.1% errors), the step where it
 * degrades and the step where it breaks. Writes JSON next to the ramp and prints Markdown.
 *
 *   node perf/src/capacity.ts --ramp ramp-A --size "2 CPU / 4 GB" --out ramp-A/capacity.json
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { routeLatencies } from './server-latency.ts';
import { parseProm } from './soak/prom.ts';
import type { SoakSample } from './soak/summary.ts';
import { activeUsers, companySize, stepVerdict, type StepRoute } from './capacity-rules.ts';

interface Metric {
  'p(95)'?: number;
  'p(99)'?: number;
  value?: number;
  count?: number;
}

const readJson = <T>(path: string): T | null =>
  existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : null;

/** "bemmoly-db-1 cpu=61.13% mem=156.7MiB / 3.8GiB" lines, as MiB and percent. */
function containerStats(text: string | null) {
  const out: Record<string, { cpu: number; memMiB: number }> = {};
  for (const line of (text ?? '').split(/\s*\|\s*|\n/)) {
    const match = /^(\S+) cpu=([\d.]+)% mem=([\d.]+)(MiB|GiB|KiB)/.exec(line.trim());
    if (!match) continue;
    const scale = match[4] === 'GiB' ? 1024 : match[4] === 'KiB' ? 1 / 1024 : 1;
    out[match[1] as string] = { cpu: Number(match[2]), memMiB: Number(match[3]) * scale };
  }
  return out;
}

const max = (values: (number | null | undefined)[]) => {
  const numbers = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return numbers.length ? Math.max(...numbers) : null;
};

function readStep(dir: string, samples: SoakSample[]) {
  const step = readJson<{ rate: number; pairs: number; startedAt: string; finishedAt: string }>(
    join(dir, 'step.json'),
  );
  const summary = readJson<{ metrics: Record<string, Metric> }>(join(dir, 'mixed.summary.json'));
  if (!step || !summary) return null;
  const metrics = summary.metrics;
  const routes: StepRoute[] = routeLatencies(
    parseProm(readFileSync(join(dir, 'before.prom'), 'utf8')),
    parseProm(readFileSync(join(dir, 'after.prom'), 'utf8')),
    20,
  ).map((r) => ({ route: `${r.method} ${r.route}`, count: r.count, p95: r.p95, p99: r.p99 }));
  const from = Date.parse(step.startedAt);
  const to = Date.parse(step.finishedAt);
  const inStep = samples.filter((s) => Date.parse(s.at) >= from && Date.parse(s.at) <= to);
  const stats = inStep.map((s) => containerStats(s.containers));
  const app = (s: ReturnType<typeof containerStats>) =>
    Object.entries(s).find(([name]) => /bemmoly-1$|app$/.test(name))?.[1];
  const db = (s: ReturnType<typeof containerStats>) =>
    Object.entries(s).find(([name]) => /db-1$|db$/.test(name))?.[1];
  const hostLoad = readFileSync(join(dir, 'host-load.txt'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => Number(line.split(' ')[1]));
  const requests = metrics['http_reqs']?.count ?? 0;
  const failedRate = metrics['http_req_failed']?.value ?? 0;
  const result = {
    rate: step.rate,
    activeUsers: activeUsers(step.rate),
    companySize: companySize(step.rate),
    pairs: step.pairs,
    startedAt: step.startedAt,
    requests,
    errorRate: failedRate,
    routes,
    collabPageOpenP95: metrics['collab_page_open']?.['p(95)'] ?? null,
    collabEchoP95: metrics['collab_remote_echo']?.['p(95)'] ?? null,
    collabDelivered: metrics['collab_delivered']?.value ?? null,
    appCpuMaxPercent: max(stats.map((s) => app(s)?.cpu)),
    dbCpuMaxPercent: max(stats.map((s) => db(s)?.cpu)),
    appRssMaxMB: max(inStep.map((s) => (s.rssBytes ?? 0) / 1e6)),
    dbMemMaxMiB: max(stats.map((s) => db(s)?.memMiB)),
    poolActiveMax: max(inStep.map((s) => s.dbPool.active)),
    poolMax: max(inStep.map((s) => s.dbPool.max)),
    dbConnectionsMax: max(inStep.map((s) => s.dbConnections)),
    queueDepthMax: max(inStep.map((s) => s.queueDepth)),
    server5xx: inStep.reduce((t, s) => t + (s.window?.serverErrors ?? 0), 0),
    hostLoadMax: max(hostLoad),
  };
  return { ...result, verdict: stepVerdict(result) };
}

function main() {
  const { values } = parseArgs({
    options: { ramp: { type: 'string' }, size: { type: 'string' }, out: { type: 'string' } },
  });
  if (!values.ramp || !values.size) throw new Error('--ramp and --size are required');
  const samples = readFileSync(join(values.ramp, 'monitor.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SoakSample);
  const steps = readdirSync(values.ramp)
    .filter((name) => name.startsWith('step-'))
    .map((name) => readStep(join(values.ramp as string, name), samples))
    .filter((step) => step !== null)
    .sort((a, b) => a.rate - b.rate);
  const limit = [...steps].reverse().find((s) => s.verdict === 'within') ?? null;
  const degrades = steps.find((s) => s.verdict !== 'within') ?? null;
  const breaks = steps.find((s) => s.verdict === 'broken') ?? null;
  const report = {
    size: values.size,
    limitRate: limit?.rate ?? null,
    limitActiveUsers: limit ? activeUsers(limit.rate) : null,
    limitCompanySize: limit ? companySize(limit.rate) : null,
    degradesAtRate: degrades?.rate ?? null,
    breaksAtRate: breaks?.rate ?? null,
    steps,
  };
  if (values.out) writeFileSync(values.out, `${JSON.stringify(report, null, 2)}\n`);
  const ms = (v: number | null | undefined) => (v === null || v === undefined ? '-' : v.toFixed(0));
  const route = (s: (typeof steps)[number], name: string) => s.routes.find((r) => r.route === name);
  const lines = [
    `| Actions/s | Active users | Errors | Board p95 | Issue p95 | Suggest p95 | Search p95 | Page p95 | Page open p95 | Echo p95 | App CPU | DB CPU | RSS MB | DB MiB | Pool | Queue | Host load | Verdict |`,
    `| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |`,
    ...steps.map(
      (s) =>
        `| ${s.rate} | ${s.activeUsers} | ${(s.errorRate * 100).toFixed(2)}% | ${ms(route(s, 'GET /api/v1/work/boards/:id/view')?.p95)} | ${ms(route(s, 'GET /api/v1/work/issues/:key')?.p95)} | ${ms(route(s, 'GET /api/v1/work/search/suggest')?.p95)} | ${ms(route(s, 'GET /api/v1/search')?.p95)} | ${ms(route(s, 'GET /api/v1/docs/pages/:pageId')?.p95)} | ${ms(s.collabPageOpenP95)} | ${ms(s.collabEchoP95)} | ${ms(s.appCpuMaxPercent)}% | ${ms(s.dbCpuMaxPercent)}% | ${ms(s.appRssMaxMB)} | ${ms(s.dbMemMaxMiB)} | ${s.poolActiveMax ?? '-'}/${s.poolMax ?? '-'} | ${s.queueDepthMax ?? '-'} | ${s.hostLoadMax?.toFixed(1) ?? '-'} | ${s.verdict} |`,
    ),
  ];
  process.stdout.write(
    `${values.size}: limit ${report.limitRate ?? 'none'}/s\n\n${lines.join('\n')}\n`,
  );
}

if (import.meta.main) main();
