#!/usr/bin/env node
/**
 * pnpm --filter @bemmoly/module-pipelines bench:dispatch [-- --jobs 5000 --workers 16 --teams 8]
 *
 * Measures the dispatcher's claim path (architecture §5.3: 50 claims a second, p99 under
 * 50 ms) against the database in apps/server/.env: queues ready jobs across teams in a
 * throwaway pool, claims them from concurrent workers until the queue is empty, checks no
 * job was claimed twice, prints claims a second and latency percentiles, and removes what
 * it created.
 */
import { parseArgs } from 'node:util';
import { createSqlClient } from '@bemmoly/core';
import { claimNextJob } from '../server/src/services/dispatcher/claim.ts';
import { hashToken, newToken } from '../server/src/utils/tokens.ts';
import { loadSeedConfig } from './demo/config.ts';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    jobs: { type: 'string', default: '5000' },
    workers: { type: 'string', default: '16' },
    teams: { type: 'string', default: '8' },
  },
});
const jobs = Number(values.jobs);
const workers = Number(values.workers);
const teamCount = Number(values.teams);
const sql = createSqlClient(loadSeedConfig().databaseUrl, {
  applicationName: 'bemmoly-dispatch-benchmark',
  maxConnections: workers + 2,
});
const out = (line: string) => process.stdout.write(`${line}\n`);
const key = `bench-${Date.now()}`;

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))] ?? 0;
}

try {
  const [pool] = await sql<{ id: string }[]>`
    insert into pipeline_runner_pools (key, name, hosting, max_runners, token_hash)
    values (${key}, ${key}, 'local', ${workers}, ${hashToken(newToken('pool'))}) returning id`;
  const teams = await sql<{ id: string }[]>`
    insert into teams (name) select ${key} || ' team ' || n from generate_series(1, ${teamCount}) n
    returning id`;
  const [run] = await sql<{ id: string }[]>`
    insert into pipeline_runs (trigger, ref, commit_sha, title)
    values ('manual', 'main', 'bench000', ${key}) returning id`;
  const [runner] = await sql<{ id: string }[]>`
    insert into pipeline_runners (pool_id, name) values (${pool?.id ?? null}, ${key}) returning id`;
  const teamIds = teams.map((team) => team.id);
  await sql`
    insert into pipeline_jobs (run_id, key, name, state, pool_id, team_id, priority_class, ready_at)
    select ${run?.id ?? null}, 'job-' || n, 'Job ' || n, 'ready', ${pool?.id ?? null},
      (${teamIds}::uuid[])[1 + n % ${teamCount}],
      (array['main', 'pull_request', 'pull_request', 'scheduled'])[1 + n % 4], now()
    from generate_series(1, ${jobs}) n`;
  out(`Queued ${jobs} jobs for ${teamCount} teams; ${workers} workers claiming…`);
  const latencies: number[] = [];
  const claimed = new Set<string>();
  let duplicates = 0;
  const started = performance.now();
  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (;;) {
        const before = performance.now();
        const job = await claimNextJob(sql, {
          poolId: pool?.id ?? '',
          runnerId: runner?.id ?? '',
          tokenHash: hashToken(newToken('job')),
        });
        if (!job) return;
        latencies.push(performance.now() - before);
        if (claimed.has(job.id)) duplicates += 1;
        claimed.add(job.id);
      }
    }),
  );
  const seconds = (performance.now() - started) / 1000;
  latencies.sort((a, b) => a - b);
  out(
    `Claimed ${claimed.size} in ${seconds.toFixed(1)} s: ${(claimed.size / seconds).toFixed(0)} claims a second`,
  );
  out(
    `Latency p50 ${percentile(latencies, 50).toFixed(1)} ms, p95 ${percentile(latencies, 95).toFixed(1)} ms, p99 ${percentile(latencies, 99).toFixed(1)} ms`,
  );
  out(duplicates === 0 ? 'No job was claimed twice.' : `${duplicates} jobs were claimed twice!`);
  if (duplicates > 0 || claimed.size !== jobs) process.exitCode = 1;
} finally {
  await sql`delete from pipeline_runs where title = ${key}`;
  await sql`delete from pipeline_runner_pools where key = ${key}`;
  await sql`delete from teams where name like ${`${key} team %`}`;
  await sql.end({ timeout: 5 });
}
