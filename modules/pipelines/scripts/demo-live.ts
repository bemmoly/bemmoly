#!/usr/bin/env node
/**
 * pnpm --filter @bemmoly/module-pipelines demo:live [-- --rate 2 --seed 7 --quiet]
 *
 * Keeps the seeded Acme demo alive while you look at it: runs start, their jobs queue, run,
 * pass and now and then fail; passing main runs become releases that deploy to Dev, move on
 * to Staging and ask to go to Prod; approvals appear (the demo person's wait a few minutes
 * for you to give them), canaries step 5% → 25% → 100% and once in a while roll back.
 * Start it beside `pnpm dev`, after `seed:demo`; it uses the database in apps/server/.env
 * and stops on Ctrl+C. --rate is actions per second (default 2, at most 10); --seed picks
 * the sequence (the same seed on the same data does the same things); --runs caps runs in
 * progress. It is off unless you start it, and it never touches rows the server is moving.
 */
import { parseArgs } from 'node:util';
import { createSqlClient } from '@bemmoly/core';
import { loadSeedConfig } from './demo/config.ts';
import { createSimulator, describe } from './simulator/index.ts';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    rate: { type: 'string', default: '2' },
    seed: { type: 'string', default: '7' },
    runs: { type: 'string' },
    quiet: { type: 'boolean', default: false },
  },
});
const rate = Number(values.rate);
const seed = Number(values.seed);
const runs = values.runs === undefined ? undefined : Number(values.runs);
if (!Number.isFinite(rate) || rate <= 0 || rate > 10) {
  process.stderr.write('--rate takes actions per second, above 0 and at most 10\n');
  process.exit(2);
}
if (!Number.isInteger(seed) || (runs !== undefined && !(Number.isInteger(runs) && runs > 0))) {
  process.stderr.write('--seed and --runs take whole numbers\n');
  process.exit(2);
}

const sql = createSqlClient(loadSeedConfig().databaseUrl, {
  applicationName: 'bemmoly-pipelines-demo-live',
  maxConnections: 2,
});
const started = Date.now();
const out = (line: string) =>
  process.stdout.write(`[live] ${((Date.now() - started) / 1000).toFixed(1)}s  ${line}\n`);

let stopping = false;
const stop = () => {
  stopping = true;
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

try {
  const simulator = await createSimulator(sql, {
    seed,
    ...(runs !== undefined ? { limits: { runs } } : {}),
  });
  const { state, limits } = simulator;
  out(
    `picked up ${state.runs.length} runs, ${state.deployments.length} deployments and ` +
      `${state.promotions.length} promotions in flight; up to ${limits.runs} runs at once, ` +
      `${rate} actions a second. Ctrl+C stops.`,
  );
  const interval = 1000 / rate;
  let counted = 0;
  while (!stopping) {
    const began = Date.now();
    const result = await simulator.tick();
    if (result.error) out(`skipped an action: ${String(result.error)}`);
    else if (result.action.kind !== 'idle') {
      counted += 1;
      if (!values.quiet && result.applied) out(describe(result.action, simulator.catalog));
    }
    const wait = interval - (Date.now() - began);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  }
  out(`stopped after ${counted} actions`);
} finally {
  await sql.end({ timeout: 5 });
}
