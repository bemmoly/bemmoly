#!/usr/bin/env node
/**
 * pnpm --filter @bemmoly/module-pipelines demo:runner [-- --apps checkout-api,payments-worker]
 *
 * Gets a seeded install ready to run pipelines for real on this machine: a "laptop" runner
 * pool with a fresh registration token, and a runnable pipeline (pool laptop, no repository
 * needed) on a few applications. Prints the command that starts a runner. Safe to repeat:
 * each run rotates the token and rewrites those pipelines.
 */
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createSqlClient } from '@bemmoly/core';
import { storable } from '../server/src/services/runs/templates.ts';
import { refreshSchedules } from '../server/src/services/triggers/schedules.ts';
import { hashToken, newToken } from '../server/src/utils/tokens.ts';
import { loadSeedConfig } from './demo/config.ts';
import { runnerDemoPipeline } from './demo/runner-pipeline.ts';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    apps: { type: 'string', default: 'checkout-api,payments-worker' },
    url: { type: 'string', default: 'http://localhost:8080' },
  },
});

const POOL = 'laptop';
const sql = createSqlClient(loadSeedConfig().databaseUrl, {
  applicationName: 'bemmoly-runner-demo',
  maxConnections: 2,
});
const out = (line: string) => process.stdout.write(`${line}\n`);

try {
  const token = newToken('pool');
  await sql`
    insert into pipeline_runner_pools (key, name, hosting, location, labels, min_runners,
      max_runners, warm_runners, token_hash, token_rotated_at)
    values (${POOL}, 'Laptop', 'local', 'This machine', ${[POOL]}::text[], 0, 4, 0,
      ${hashToken(token)}, now())
    on conflict (key) do update set token_hash = excluded.token_hash, token_rotated_at = now(),
      updated_at = now()`;
  const keys = (values.apps ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  const appDirectory = fileURLToPath(new URL('./demo/app', import.meta.url));
  const pipeline = JSON.stringify(storable(runnerDemoPipeline(POOL, appDirectory)));
  const apps = await sql<{ id: string; key: string }[]>`
    update pipeline_applications set pipeline = ${pipeline}::jsonb, pipeline_source = 'catalog',
      updated_at = now()
    where key = any(${keys}::text[]) returning id, key`;
  for (const app of apps) await refreshSchedules(sql, app.id);
  const missing = keys.filter((key) => !apps.some((app) => app.key === key));
  out(
    `Pool "${POOL}" is ready. Pipelines set on: ${apps.map((app) => app.key).join(', ') || 'none'}`,
  );
  if (missing.length > 0) out(`Not found (seed the demo first?): ${missing.join(', ')}`);
  out('');
  out('Start a runner that runs steps as processes on this machine:');
  out(
    `  node apps/runner/src/main.ts --url ${values.url} --pool-token ${token} --local --data-dir /tmp/bemmoly-runner-laptop --allow-build-path ${appDirectory}`,
  );
  out('Or, with Docker or Colima running, as containers: leave out --local.');
  out('');
  out(`Then open an application above and choose Run pipeline… (or POST /api/v1/pipelines/runs).`);
} finally {
  await sql.end({ timeout: 5 });
}
