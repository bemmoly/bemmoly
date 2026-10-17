import type { TestCaseResult, TestReportUpload } from '../../shared/runner.ts';
import type { Rng } from './rng.ts';

/*
 * What a job printed, step by step, and the JUnit summary a test job reported: the lines a
 * real runner would have sent for a build, a test shard, lint or the security scan. A
 * failing job ends on a plausible error, and a failing test shard's error names the same
 * test its report marks failed, so the log, the failure groups and the flaky list agree.
 */

export interface LogJob {
  key: string;
  name: string;
  kind: string;
  failed: boolean;
  appKey: string;
}

export interface JobOutput {
  /** Lines per step position: Check out, Restore cache, Run, Save cache. */
  steps: string[][];
  report: TestReportUpload | null;
}

const RED = '\u001b[31m';
const GREEN = '\u001b[32m';
const DIM = '\u001b[2m';
const RESET = '\u001b[0m';

const AREAS = ['orders', 'payments', 'refunds', 'ledger', 'catalog', 'search', 'sessions'];
const SPECS = ['create', 'update', 'idempotency', 'webhooks', 'pricing', 'limits', 'retry'];
const CASES = [
  'keeps one record per idempotency key',
  'retries on a gateway timeout',
  'rejects an amount below zero',
  'rounds tax per line, not per order',
  'returns 404 for an unknown id',
  'pages with a stable cursor',
  'signs the webhook body',
];

function testFiles(rng: Rng, appKey: string): string[] {
  const area = appKey.split('-')[0] ?? rng.pick(AREAS);
  return rng
    .shuffle([...SPECS])
    .slice(0, 5)
    .map((spec) => `src/${area}/${spec}.spec.ts`);
}

function checkout(rng: Rng, appKey: string): string[] {
  const sha = rng.hex(40);
  return [
    `Fetching acme/${appKey} at ${sha.slice(0, 12)}`,
    `${DIM}remote: Enumerating objects: ${rng.int(800, 9000)}, done.${RESET}`,
    `HEAD is now at ${sha.slice(0, 7)}`,
  ];
}

function cache(rng: Rng, saving: boolean): string[] {
  const size = rng.int(80, 900);
  return saving
    ? [`Saving cache pnpm-store-${rng.hex(8)} (${size} MB)`, 'Cache saved']
    : [
        `Restoring cache pnpm-store-${rng.hex(8)}`,
        `Cache restored (${size} MB) in ${rng.int(2, 9)}s`,
      ];
}

function testRun(rng: Rng, job: LogJob): { lines: string[]; report: TestReportUpload } {
  const files = testFiles(rng, job.appKey);
  const cases: TestCaseResult[] = [];
  const lines = [`$ pnpm test ${job.key.startsWith('unit-') ? `--shard=${job.key.slice(5)}` : ''}`];
  lines.push(` RUN  v5.0.3 /workspace/${job.appKey}`, '');
  const failing = job.failed ? rng.int(0, files.length - 1) : -1;
  files.forEach((file, index) => {
    const names = rng.shuffle([...CASES]).slice(0, rng.int(3, 5));
    const broken = index === failing ? names.slice(0, 2) : [];
    for (const name of names) {
      const failed = broken.includes(name);
      cases.push({
        file,
        name,
        line: failed ? rng.int(20, 180) : null,
        outcome: failed ? 'failed' : 'passed',
        durationMs: rng.int(4, 400),
        message: failed ? `AssertionError: expected ${rng.int(2, 3)} to be 1` : null,
      });
    }
    const ms = rng.int(80, 2400);
    lines.push(
      broken.length > 0
        ? `${RED} FAIL ${RESET} ${file} (${names.length} tests | ${broken.length} failed) ${ms}ms`
        : `${GREEN} PASS ${RESET} ${file} (${names.length} tests) ${ms}ms`,
    );
  });
  const failed = cases.filter((c) => c.outcome === 'failed');
  for (const c of failed) {
    lines.push(
      '',
      `${RED} FAIL ${RESET} ${c.file} > ${c.name}`,
      `${RED}${c.message ?? 'AssertionError'}${RESET}`,
      ` > ${c.file}:${c.line ?? 1}:${rng.int(5, 40)}`,
    );
  }
  const total = rng.int(90, 160);
  const skipped = rng.int(0, 3);
  const passed = total - skipped - failed.length;
  lines.push(
    '',
    ` Test Files  ${failed.length > 0 ? `1 failed | ${files.length - 1} passed` : `${files.length} passed`} (${files.length})`,
    `      Tests  ${failed.length > 0 ? `${failed.length} failed | ` : ''}${passed} passed | ${skipped} skipped (${total})`,
    `   Duration  ${(rng.int(40, 400) / 10).toFixed(1)}s`,
  );
  if (failed.length > 0) lines.push(`${RED}Error: ${failed.length} tests failed${RESET}`);
  const durationMs = cases.reduce((sum, c) => sum + c.durationMs, 0);
  return { lines, report: { total, passed, failed: failed.length, skipped, durationMs, cases } };
}

function lintRun(rng: Rng, job: LogJob): string[] {
  const lines = ['$ pnpm lint && pnpm typecheck'];
  if (!job.failed) return [...lines, `Checked ${rng.int(120, 900)} files`, 'No problems found'];
  const area = job.appKey.split('-')[0] ?? 'app';
  return [
    ...lines,
    `/workspace/${job.appKey}/src/${area}/banner.tsx`,
    `  ${rng.int(10, 90)}:${rng.int(3, 30)}  ${RED}error${RESET}  'legacyBanner' is assigned a value but never used  no-unused-vars`,
    `  ${rng.int(10, 90)}:${rng.int(3, 30)}  ${RED}error${RESET}  Unexpected any. Specify a different type  no-explicit-any`,
    `${RED}3 problems (3 errors, 0 warnings)${RESET}`,
  ];
}

function buildRun(rng: Rng, job: LogJob): string[] {
  const lines = [
    '$ docker buildx build --push .',
    `#1 [internal] load build definition from Dockerfile`,
    `#5 [build 3/6] RUN pnpm install --frozen-lockfile`,
    `#5 DONE ${(rng.int(80, 600) / 10).toFixed(1)}s`,
    `#7 [build 5/6] RUN pnpm build`,
  ];
  if (job.failed) {
    return [
      ...lines,
      `#7 ${RED}src/index.ts(${rng.int(10, 99)},7): error TS2322: Type 'string' is not assignable to type 'number'.${RESET}`,
      `${RED}ERROR: failed to solve: process "/bin/sh -c pnpm build" did not complete successfully: exit code: 2${RESET}`,
    ];
  }
  return [
    ...lines,
    `#7 DONE ${(rng.int(200, 1400) / 10).toFixed(1)}s`,
    `#9 pushing asia-south1-docker.pkg.dev/acme-ci/${job.appKey}@sha256:${rng.hex(64)}`,
    '#9 DONE',
  ];
}

/** Everything one job printed, and its test report when it ran tests. */
export function jobOutput(job: LogJob, rng: Rng): JobOutput {
  let run: string[];
  let report: TestReportUpload | null = null;
  if (job.kind === 'test' && job.key === 'lint') run = lintRun(rng, job);
  else if (job.kind === 'test') {
    const tests = testRun(rng, job);
    run = tests.lines;
    report = tests.report;
  } else if (job.kind === 'scan') {
    run = [
      '$ bemmoly scan --fail-on high',
      `Scanned ${rng.int(300, 1800)} dependencies and the image`,
      `0 high, ${rng.int(0, 4)} medium findings`,
    ];
  } else if (job.kind === 'build' || job.kind === 'publish') run = buildRun(rng, job);
  else run = [`$ ${job.name}`, 'Done'];
  const exit = job.failed
    ? [`${RED}Process exited with code 1${RESET}`]
    : ['Process exited with code 0'];
  return {
    steps: [
      checkout(rng, job.appKey),
      cache(rng, false),
      [...run, ...exit],
      job.failed ? [] : cache(rng, true),
    ],
    report,
  };
}
