import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeStep } from '../../test/fake-control-plane.ts';
import { DockerEngine } from '../clients/docker-engine.ts';
import { defaultDockerSocket } from '../config/env.ts';
import { DockerExecutor } from './docker.ts';

const engine = new DockerEngine(defaultDockerSocket(process.env));
const available = await engine.ping();

// Colima shares the home folder with its VM, so the workspace lives there rather than in /tmp.
let workspace: string;
beforeAll(async () => {
  if (available) workspace = await mkdtemp(path.join(homedir(), '.bemmoly-runner-int-'));
});
afterAll(async () => {
  if (workspace) await rm(workspace, { recursive: true, force: true });
});

describe.skipIf(!available)('steps as containers', () => {
  it('runs alpine:3.20 echo hello through the Docker socket', async () => {
    const lines: string[] = [];
    const result = await new DockerExecutor(engine).run(
      makeStep('hello', 'echo hello; echo "$GREETING" >&2; echo written > out.txt; exit 4', {
        image: 'alpine:3.20',
      }),
      { workspace, env: { GREETING: 'from env' }, onLine: (l) => lines.push(l), label: 'int-test' },
    );
    expect(result.exitCode).toBe(4);
    expect(lines).toContain('hello');
    expect(lines).toContain('from env');
    expect(await readFile(path.join(workspace, 'out.txt'), 'utf8')).toBe('written\n');
  }, 180_000);

  it('stops a running container on cancel', async () => {
    const executor = new DockerExecutor(engine);
    const lines: string[] = [];
    const running = executor.run(
      makeStep('long', 'echo started; sleep 60', { image: 'alpine:3.20' }),
      {
        workspace,
        env: {},
        onLine: (l) => lines.push(l),
        label: 'int-cancel',
      },
    );
    while (!lines.includes('started')) await new Promise((r) => setTimeout(r, 50));
    await executor.cancel();
    expect((await running).exitCode).not.toBe(0);
  }, 180_000);
});
