import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ResolvedStep, RunnerPod } from '@bemmoly/module-pipelines/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { envFile, PodExecutor, stepTarget } from './pod.ts';

/*
 * Steps handed to the containers beside the runner in a pod, played here by the real step
 * agent under this machine's sh in one folder per container: output arrives line by line,
 * the exit code comes back, quotes in values survive, the environment file is gone
 * once the step ends, and a cancel stops a long step.
 */

const AGENT = new URL('../../agent/step-agent.sh', import.meta.url).pathname;

const step = (run: string, image: string | null = 'node:24'): ResolvedStep => ({
  key: 'test',
  name: 'Test',
  image,
  run,
  uses: null,
  env: {},
  secrets: [],
  locked: false,
  origin: 'application',
  junit: null,
  artifacts: [],
});

describe('steps in the containers beside the runner', () => {
  let base: string;
  let workspace: string;
  let pod: RunnerPod;
  let agent: ChildProcess;

  beforeEach(async () => {
    base = await mkdtemp(path.join(tmpdir(), 'runner-pod-'));
    workspace = path.join(base, 'work', 'job');
    await mkdir(workspace, { recursive: true });
    pod = {
      control: path.join(base, 'control'),
      logs: path.join(base, 'logs'),
      steps: { 'node:24': 'step-0' },
      builder: null,
    };
    // Its own process group, so the test stops the agent and anything it started.
    agent = spawn('sh', [AGENT, path.join(pod.control, 'step-0'), path.join(pod.logs, 'step-0')], {
      detached: true,
      stdio: 'ignore',
    });
  });

  afterEach(async () => {
    if (agent.pid) process.kill(-agent.pid, 'SIGKILL');
    await rm(base, { recursive: true, force: true });
  });

  const options = (lines: string[], env: Record<string, string> = {}) => ({
    workspace,
    env,
    onLine: (line: string) => lines.push(line),
    label: '0199f0bb-1',
  });

  it('runs a step in its image container and reports its output and exit code', async () => {
    const lines: string[] = [];
    const executor = new PodExecutor(pod, (s) => stepTarget(pod, s));
    const result = await executor.run(
      step('echo "hello $WHO"; echo "two words $TWO"; pwd; exit 3'),
      options(lines, { WHO: "it's me", TWO: 'a  b', 'not-a-name': 'skipped' }),
    );
    expect(result).toEqual({ exitCode: 3 });
    expect(lines.slice(0, 2)).toEqual(["hello it's me", 'two words a  b']);
    expect(await realpath(lines[2] ?? '')).toBe(await realpath(workspace));
    expect(await readdir(path.join(pod.control, 'step-0'))).toEqual([]);
  });

  it('stops a long step when the job is cancelled', async () => {
    const lines: string[] = [];
    const executor = new PodExecutor(pod, (s) => stepTarget(pod, s));
    const running = executor.run(step('echo started; sleep 30; echo never'), options(lines));
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await executor.cancel();
    const result = await running;
    expect(result.exitCode).toBe(143);
    expect(lines).toEqual(['started']);
  });

  it('says so when the pod has no container for the step image', async () => {
    const lines: string[] = [];
    const executor = new PodExecutor(pod, (s) => stepTarget(pod, s));
    expect(await executor.run(step('true', 'python:3.13'), options(lines))).toEqual({
      exitCode: 1,
    });
    expect(lines[0]).toMatch(/^This pod has no container for python:3\.13/);
  });

  it('writes an environment a POSIX shell sources as it was', () => {
    expect(envFile({ A: "x'y", B: 'line\nnext', 'bad-name': 'z' })).toBe(
      "export A='x'\\''y'\nexport B='line\nnext'\n",
    );
  });
});
