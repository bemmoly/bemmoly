#!/usr/bin/env node
/**
 * Watches an install during a soak: every --interval seconds it scrapes /metrics and records
 * RSS, heap, event-loop lag, the database pool, job queue depth, WebSocket connections, and
 * the window's requests, error rate and p95 (API routes, from the latency histogram). At the
 * end (SIGINT, or --duration) it writes a summary with the trends: memory growth per hour,
 * p95 drift from the first tenth of the run to the last, peaks and the overall error rate.
 *
 * The scrape is a shell command, so the metrics token never has to leave the server:
 *   --metrics-cmd 'ssh host "sudo sh -c \"curl -s -H \\\"Authorization: Bearer \$(grep …)\\\" …\""'
 * Optional: --db-cmd prints the number of open Postgres connections, --stats-cmd prints
 * `docker stats --no-stream` lines, both recorded as they are.
 *
 *   node perf/src/soak/monitor.ts --metrics-cmd '…' --out soak-samples.jsonl --summary soak.json
 */
import { exec } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { promisify } from 'node:util';
import {
  buckets,
  first,
  isApiRoute,
  parseProm,
  sum,
  windowCounts,
  windowQuantile,
  type Sample,
} from './prom.ts';
import { summarise, type SoakSample } from './summary.ts';

const run = promisify(exec);
const log = (line: string) => process.stderr.write(`${line}\n`);
const COMMAND_TIMEOUT_MS = 20_000;

async function shell(command: string): Promise<string> {
  const { stdout } = await run(command, {
    timeout: COMMAND_TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

function sampleOf(at: Date, before: Sample[] | null, after: Sample[]): SoakSample {
  const queues = after.filter((s) => s.name === 'bemmoly_job_queue_depth');
  const busy = Object.fromEntries(
    queues.filter((s) => s.value > 0).map((s) => [s.labels['queue'], s.value]),
  );
  const pool = (state: string) =>
    first(after, 'bemmoly_db_pool_connections', (l) => l['state'] === state) ?? null;
  const window = before ? windowCounts(before, after) : null;
  const latency = before
    ? {
        p50: windowQuantile(buckets(before, isApiRoute), buckets(after, isApiRoute), 0.5),
        p95: windowQuantile(buckets(before, isApiRoute), buckets(after, isApiRoute), 0.95),
        p99: windowQuantile(buckets(before, isApiRoute), buckets(after, isApiRoute), 0.99),
      }
    : null;
  return {
    at: at.toISOString(),
    rssBytes: first(after, 'bemmoly_process_resident_memory_bytes') ?? null,
    heapUsedBytes: first(after, 'bemmoly_nodejs_heap_size_used_bytes') ?? null,
    eventLoopLagP99Ms:
      (first(after, 'bemmoly_nodejs_eventloop_lag_p99_seconds') ?? 0) * 1000 || null,
    dbPool: {
      active: pool('active'),
      idle: pool('idle'),
      max: pool('max'),
      idleInTransaction: pool('idle_in_transaction'),
    },
    queueDepth: sum(after, 'bemmoly_job_queue_depth'),
    queueDelayed: sum(after, 'bemmoly_job_queue_delayed'),
    busyQueues: busy,
    websockets: first(after, 'bemmoly_websocket_connections') ?? null,
    window,
    latencyMs: latency,
    dbConnections: null,
    containers: null,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      'metrics-cmd': { type: 'string' },
      'db-cmd': { type: 'string' },
      'stats-cmd': { type: 'string' },
      interval: { type: 'string', default: '15' },
      duration: { type: 'string' },
      out: { type: 'string' },
      summary: { type: 'string' },
    },
  });
  if (!values['metrics-cmd'] || !values.out || !values.summary) {
    throw new Error('--metrics-cmd, --out and --summary are required');
  }
  const intervalMs = Number(values.interval) * 1000;
  const stopAt = values.duration
    ? Date.now() + Number(values.duration) * 1000
    : Number.POSITIVE_INFINITY;
  writeFileSync(values.out, '');
  const samples: SoakSample[] = [];
  let previous: Sample[] | null = null;
  let stopping = false;
  const finish = () => {
    const summary = summarise(samples);
    writeFileSync(values.summary as string, `${JSON.stringify(summary, null, 2)}\n`);
    log(`Wrote ${samples.length} samples; summary in ${values.summary}`);
    process.exit(0);
  };
  process.on('SIGINT', () => (stopping = true));
  process.on('SIGTERM', () => (stopping = true));

  while (!stopping && Date.now() < stopAt) {
    const tick = Date.now();
    try {
      const scraped = parseProm(await shell(values['metrics-cmd']));
      const sample = sampleOf(new Date(), previous, scraped);
      if (values['db-cmd'])
        sample.dbConnections = Number((await shell(values['db-cmd'])).trim()) || null;
      if (values['stats-cmd']) sample.containers = (await shell(values['stats-cmd'])).trim();
      previous = scraped;
      samples.push(sample);
      appendFileSync(values.out, `${JSON.stringify(sample)}\n`);
      const mb = (bytes: number | null) => (bytes === null ? '?' : (bytes / 1e6).toFixed(0));
      log(
        `${sample.at} rss ${mb(sample.rssBytes)} MB heap ${mb(sample.heapUsedBytes)} MB ` +
          `db ${sample.dbConnections ?? sample.dbPool.active ?? '?'} queue ${sample.queueDepth} ` +
          `p95 ${sample.latencyMs?.p95?.toFixed(1) ?? '-'} ms req ${sample.window?.requests ?? '-'} ` +
          `5xx ${sample.window?.serverErrors ?? '-'} 429 ${sample.window?.rateLimited ?? '-'}`,
      );
    } catch (error) {
      log(`sample failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const wait = intervalMs - (Date.now() - tick);
    for (let waited = 0; waited < wait && !stopping; waited += 250) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  finish();
}

await main();
