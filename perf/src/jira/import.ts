#!/usr/bin/env node
/**
 * A real import through Settings › Import's API, timed against tech design §24's exit
 * criterion: a 10,000-issue Jira site in under 30 minutes on the reference VM. Runs as the
 * load admin against the site serve.ts serves; the clock runs from "run" to the job settling,
 * as the importer performance test measures it.
 *
 *   node perf/src/jira/import.ts --base-url https://… --credentials load-credentials.json \
 *     --site http://host.lima.internal:8765 --out import-result.json
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { FIXTURE_EMAIL, FIXTURE_TOKEN } from '../../../apps/server/src/imports/fake-atlassian.ts';
import { createApi } from '../clients/api.ts';
import { readCredentials } from '../lib/credentials.ts';
import { IMPORT_KEY, SOURCE_PROJECT_ID } from './rewrite.ts';

const log = (line: string) => process.stderr.write(`${line}\n`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const SETTLED = new Set(['completed', 'failed', 'cancelled']);

interface Counts {
  created: number;
  updated: number;
  skipped: number;
}
interface ImportJob {
  id: string;
  status: string;
  phase: string | null;
  progress: { done: number; total: number } | null;
  discovery: { containers: { id: string; key: string; name: string; count: number }[] } | null;
  report: { counts: Record<string, Counts>; skippedTotal: number; warnings: string[] } | null;
  error: unknown;
}

async function main() {
  const { values } = parseArgs({
    options: {
      'base-url': { type: 'string' },
      credentials: { type: 'string' },
      site: { type: 'string' },
      out: { type: 'string' },
      'budget-minutes': { type: 'string', default: '30' },
      'poll-ms': { type: 'string', default: '2000' },
      key: { type: 'string', default: IMPORT_KEY },
    },
  });
  if (!values['base-url'] || !values.credentials || !values.site || !values.out) {
    throw new Error('--base-url, --credentials, --site and --out are required');
  }
  const api = createApi(values['base-url'], readCredentials(values.credentials).admin.token);
  const budgetSeconds = Number(values['budget-minutes']) * 60;

  const connected = await api.post<ImportJob>('/admin/imports', {
    source: 'jira',
    values: { deployment: 'cloud', url: values.site, email: FIXTURE_EMAIL, token: FIXTURE_TOKEN },
  });
  const container = connected.discovery?.containers.find((c) => c.id === SOURCE_PROJECT_ID);
  if (!container || container.key !== values.key) {
    throw new Error(
      `The site does not offer ${values.key}; is the proxy from serve.ts in front of it?`,
    );
  }
  log(`Connected: ${container.key} "${container.name}" with ${container.count} issues`);
  await api.patch(`/admin/imports/${connected.id}`, { containers: [container.id] });

  const started = performance.now();
  const startedAt = new Date().toISOString();
  await api.post(`/admin/imports/${connected.id}/run`);
  const phases: { phase: string; atSeconds: number }[] = [];
  let job: ImportJob;
  let lastLog = 0;
  for (;;) {
    await sleep(Number(values['poll-ms']));
    job = await api.get<ImportJob>(`/admin/imports/${connected.id}`);
    const elapsed = (performance.now() - started) / 1000;
    if (job.phase && phases.at(-1)?.phase !== job.phase) {
      phases.push({ phase: job.phase, atSeconds: Math.round(elapsed) });
    }
    if (elapsed - lastLog >= 30 || SETTLED.has(job.status)) {
      lastLog = elapsed;
      const progress = job.progress ? `${job.progress.done}/${job.progress.total}` : '';
      log(`${Math.round(elapsed)} s  ${job.status}  ${job.phase ?? ''} ${progress}`);
    }
    if (SETTLED.has(job.status)) break;
  }
  const elapsedSeconds = Math.round((performance.now() - started) / 100) / 10;
  const result = {
    importId: connected.id,
    site: values.site,
    issuesOffered: container.count,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: job.status,
    elapsedSeconds,
    budgetSeconds,
    withinBudget: job.status === 'completed' && elapsedSeconds < budgetSeconds,
    issuesPerSecond: Math.round((container.count / elapsedSeconds) * 10) / 10,
    phases,
    counts: job.report?.counts ?? {},
    skippedTotal: job.report?.skippedTotal ?? 0,
    warnings: job.report?.warnings ?? [],
    error: job.error ?? null,
  };
  writeFileSync(values.out, `${JSON.stringify(result, null, 2)}\n`);
  log(
    `Import ${job.status} in ${elapsedSeconds} s (budget ${budgetSeconds} s): ${result.withinBudget ? 'PASS' : 'FAIL'}`,
  );
  if (!result.withinBudget) process.exitCode = 1;
}

await main();
