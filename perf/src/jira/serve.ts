#!/usr/bin/env node
/**
 * Serves the importers' fake Jira Cloud site (apps/server/src/imports) with N generated
 * issues, behind a proxy on a reachable address, for a real import on a real install:
 *
 *   node perf/src/jira/serve.ts --issues 10000 --port 8765
 *
 * The install connects to http://<this machine>:8765 as a Jira Cloud site with the fixture's
 * email and token (see import.ts). Each issue carries two comments, labels, a sprint, story
 * points, an epic parent and a link, as the importer performance test has them. Ctrl-C stops.
 */
import { parseArgs } from 'node:util';
import { startFakeSite } from '../../../apps/server/src/imports/fake-atlassian.ts';
import { generateIssues } from '../../../apps/server/src/imports/generate.ts';
import { startProxy } from '../clients/fake-jira-proxy.ts';
import { LOAD_PREFIX } from '../lib/credentials.ts';
import { DEFAULT_TARGET } from './rewrite.ts';

const log = (line: string) => process.stderr.write(`${line}\n`);
const STATS_EVERY_MS = 30_000;

async function main() {
  const { values } = parseArgs({
    options: {
      issues: { type: 'string', default: '10000' },
      port: { type: 'string', default: '8765' },
      host: { type: 'string', default: '0.0.0.0' },
      'page-size': { type: 'string', default: '100' },
      key: { type: 'string', default: DEFAULT_TARGET.key },
      name: { type: 'string', default: DEFAULT_TARGET.name },
    },
  });
  const count = Number(values.issues);
  if (!/^LOAD[A-Z0-9]{1,6}$/.test(values.key) || !values.name.startsWith(`${LOAD_PREFIX} `)) {
    throw new Error('--key must look like LOADK and --name start with "LOAD "');
  }
  const site = await startFakeSite({
    kind: 'jira-cloud',
    pageSize: Number(values['page-size']),
    issues: generateIssues(count),
  });
  const proxy = await startProxy(site.url, values.host, Number(values.port), {
    key: values.key,
    name: values.name,
  });
  log(`Fake Jira Cloud: ${values.key} with ${count} issues on http://${values.host}:${proxy.port}`);
  let last = 0;
  const timer = setInterval(() => {
    if (proxy.stats.requests === last) return;
    last = proxy.stats.requests;
    log(
      `${new Date().toISOString()} ${last} requests, ${(proxy.stats.bytesOut / 1e6).toFixed(1)} MB served`,
    );
  }, STATS_EVERY_MS);
  const stop = async () => {
    clearInterval(timer);
    await proxy.close();
    await site.close();
    log(`Stopped after ${proxy.stats.requests} requests`);
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

await main();
