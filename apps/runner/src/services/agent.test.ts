import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { LogChunkUpload } from '@bemmoly/module-pipelines/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeControlPlane, makeJob, makeStep } from '../../test/fake-control-plane.ts';
import { ControlPlaneClient } from '../clients/control-plane.ts';
import { createLogger } from '../config/logger.ts';
import { createExecutors } from '../executors/index.ts';
import { Agent } from './agent.ts';
import { Outbox } from './outbox.ts';

const logger = createLogger('silent');
const FAST_RETRY = { attempts: 2, baseMs: 10, maxMs: 20 };

let server: FakeControlPlane;
let dataDir: string;

beforeEach(async () => {
  server = await new FakeControlPlane().start();
  dataDir = await mkdtemp(path.join(tmpdir(), 'bemmoly-runner-'));
});

afterEach(async () => {
  await server.stop();
  await rm(dataDir, { recursive: true, force: true });
});

function agentFor(options: { once?: boolean; poolToken?: string } = {}): Agent {
  const client = new ControlPlaneClient({ url: server.url, logger, retry: FAST_RETRY });
  return new Agent({
    client,
    logger,
    once: options.once ?? true,
    claimWaitSeconds: 1,
    registration: {
      client,
      logger,
      dataDir,
      url: server.url,
      poolToken: options.poolToken ?? 'pool-token-0123456789',
      name: 'test-runner',
      version: '1.1.0',
      labels: ['linux'],
    },
    job: {
      executors: createExecutors({
        local: true,
        dockerSocket: '/nonexistent.sock',
        hostEnv: { PATH: '/usr/bin:/bin', HOME: dataDir },
      }),
      outbox: new Outbox(path.join(dataDir, 'outbox')),
      workRoot: path.join(dataDir, 'work'),
      apiUrl: server.url,
      drainBoundMs: 5_000,
      finishRetry: FAST_RETRY,
    },
  });
}

/** Every line the server received, in seq order, rebuilt from the chunks. */
function receivedLines(): { seq: number; lines: string[]; chunk: LogChunkUpload }[] {
  return server
    .of('/logs')
    .map((call) => call.body as LogChunkUpload)
    .map((chunk) => ({ seq: chunk.seq, lines: chunk.lines ?? [], chunk }));
}

const JUNIT = `<testsuite name="s"><testcase classname="a.B" name="ok" time="0.5"/><testcase classname="a.B" name="bad"><failure message="nope"/></testcase></testsuite>`;

describe('a job in local process mode', () => {
  it('runs steps in order, skips after a failure, and finishes failed with the error line', async () => {
    server.secrets = { API_KEY: 'super-secret-value' };
    const job = makeJob({
      env: { FROM_JOB: 'job-env' },
      shard: { index: 1, total: 3 },
      matrix: { node: 24 },
      steps: [
        makeStep(
          'first',
          [
            'echo hello',
            'echo "key=$API_KEY"',
            'echo "$FROM_JOB $CI $BEMMOLY_SHARD_INDEX/$BEMMOLY_SHARD_TOTAL $BEMMOLY_MATRIX_NODE"',
            `printf '%s' '${JUNIT}' > report.xml`,
            'echo kept > out.txt',
          ].join(' && '),
          { secrets: ['API_KEY'], junit: '*.xml', artifacts: ['out.txt'] },
        ),
        makeStep('second', 'echo working; echo "Error: boom happened" >&2; exit 3'),
        makeStep('third', 'echo never'),
      ],
    });
    server.jobs.push(job);

    const agent = agentFor();
    await agent.run();

    expect(agent.outcomes).toEqual(['failed']);
    const states = server.of(/\/steps\/\d+\/state/).map((call) => ({
      position: Number(/steps\/(\d+)/.exec(call.path)![1]),
      ...(call.body as { state: string; exitCode?: number; firstLine?: number }),
    }));
    expect(states.map((s) => [s.position, s.state, s.exitCode])).toEqual([
      [0, 'running', undefined],
      [0, 'passed', 0],
      [1, 'running', undefined],
      [1, 'failed', 3],
      [2, 'skipped', undefined],
    ]);
    expect(server.of(`/jobs/${job.jobId}/state`)[0]!.body).toMatchObject({ state: 'running' });

    const chunks = receivedLines();
    expect(chunks.map((c) => c.seq)).toEqual(chunks.map((_, i) => i));
    let expectedLine = 1;
    for (const { chunk } of chunks) {
      expect(chunk.firstLine).toBe(expectedLine);
      expectedLine += chunk.lineCount;
    }
    const all = chunks.flatMap((c) => c.lines);
    expect(all).toContain('hello');
    expect(all).toContain('key=***');
    expect(all.join('\n')).not.toContain('super-secret-value');
    expect(all).toContain('job-env true 1/3 24');
    expect(all).toContain('Error: boom happened');
    expect(all).not.toContain('never');
    const secondStart = states.find((s) => s.position === 1 && s.state === 'running')!.firstLine!;
    expect(all[secondStart - 1]).toBe('working');

    expect(server.of('/tests')[0]!.body).toMatchObject({ total: 2, passed: 1, failed: 1 });
    const artifact = server.of('/artifacts', 'PUT')[0]!;
    expect(artifact.path).toContain('name=out.txt');
    expect(artifact.raw.toString()).toBe('kept\n');

    expect(server.of('/finish')[0]!.body).toMatchObject({
      state: 'failed',
      failureSummary: 'Error: boom happened',
    });
    expect(await readdir(path.join(dataDir, 'outbox'))).toEqual([]);
  });

  it('names the step and exit code when the output shows no error line', async () => {
    server.jobs.push(makeJob({ steps: [makeStep('quiet', 'echo fine; exit 2')] }));
    await agentFor().run();
    expect(server.of('/finish')[0]!.body).toMatchObject({
      state: 'failed',
      failureSummary: 'quiet exited with 2',
    });
  });

  it('refuses a uses step it does not know, by name', async () => {
    server.jobs.push(
      makeJob({ steps: [makeStep('deploy', '', { run: null, uses: 'acme/deploy@v2' })] }),
    );
    await agentFor().run();
    const lines = receivedLines().flatMap((c) => c.lines);
    expect(lines.join('\n')).toContain('uses: acme/deploy@v2');
    expect(server.of('/finish')[0]!.body).toMatchObject({ state: 'failed' });
  });

  it('keeps chunks through a control-plane outage and resends them in order', async () => {
    server.failLogs = 3;
    server.jobs.push(makeJob({ steps: [makeStep('one', 'for i in 1 2 3; do echo line$i; done')] }));
    await agentFor().run();
    const delivered = receivedLines();
    const accepted = delivered.slice(3);
    expect(delivered.slice(0, 3).every((c) => c.seq === 0)).toBe(true);
    expect(accepted.map((c) => c.seq)).toEqual(accepted.map((_, i) => i));
    expect(accepted.flatMap((c) => c.lines)).toEqual(['line1', 'line2', 'line3']);
    expect(server.of('/finish')[0]!.body).toMatchObject({ state: 'passed' });
  });
});

describe('the agent', () => {
  it('cancels the running step when a heartbeat says so and finishes as cancelled', async () => {
    server.heartbeatSeconds = 1;
    server.jobs.push(
      makeJob({ steps: [makeStep('long', 'echo started; sleep 30'), makeStep('after', 'true')] }),
    );
    const agent = agentFor();
    const running = agent.run();
    await server.waitFor(() =>
      server.of(/steps\/0\/state/).some((c) => (c.body as { state: string }).state === 'running'),
    );
    server.heartbeat = { cancel: true, drain: false };
    await running;
    expect(server.of('/finish')[0]!.body).toMatchObject({ state: 'cancelled' });
    const states = server.of(/steps\/\d\/state/).map((c) => (c.body as { state: string }).state);
    expect(states).toEqual(['running', 'cancelled', 'skipped']);
    expect(
      server.of('/heartbeat').some((c) => (c.body as { state: string }).state === 'busy'),
    ).toBe(true);
  });

  it('saves its registration privately and reuses it on the next start', async () => {
    server.jobs.push(makeJob({ steps: [makeStep('a', 'true')] }));
    await agentFor().run();
    server.jobs.push(makeJob({ steps: [makeStep('b', 'true')] }));
    await agentFor().run();
    expect(server.of('/register')).toHaveLength(1);
    const file = path.join(dataDir, 'registration.json');
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ url: server.url });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it('registers again once when the control plane no longer knows its token', async () => {
    await writeFile(
      path.join(dataDir, 'registration.json'),
      JSON.stringify({ runnerId: 'r', runnerToken: 'stale', url: server.url }),
    );
    server.jobs.push(makeJob({ steps: [makeStep('a', 'true')] }));
    await agentFor().run();
    expect(server.of('/register')).toHaveLength(1);
    expect(server.of('/finish')[0]!.body).toMatchObject({ state: 'passed' });
  });

  it('stops a job the server took away without finishing it', async () => {
    server.override = (call) =>
      call.path.includes('/steps/')
        ? { status: 401, body: { code: 'unauthenticated' } }
        : undefined;
    server.jobs.push(makeJob({ steps: [makeStep('a', 'true')] }));
    const agent = agentFor();
    await agent.run();
    expect(agent.outcomes).toEqual(['lost']);
    expect(server.of('/finish')).toHaveLength(0);
  });
});
