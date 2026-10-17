import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { promisify } from 'node:util';
import { REPO_ROOT, statePath } from './state.ts';

const run = promisify(execFile);

/**
 * The Pipelines half of an install, done the way the walkthrough in docs/pipelines/try-it.md
 * does it: the module's own scripts seed Acme and get a runner pool ready, and a real
 * bemmoly-runner claims the jobs. Nothing here writes to the database itself.
 */

/** `seed:demo`: Acme's catalog, history and live picture, for the first admin's For you. */
export async function seedAcme(envFile: string, scale: number): Promise<string> {
  const { stdout } = await run(
    process.execPath,
    [`--env-file=${envFile}`, 'modules/pipelines/scripts/seed-demo.ts', '--scale', String(scale)],
    { cwd: REPO_ROOT, maxBuffer: 16 * 1024 * 1024 },
  );
  return stdout;
}

export interface LaptopPool {
  token: string;
  /** The demo application's folder, which its image build reads from outside the workspace. */
  allowBuildPath?: string;
}

/** `demo:runner`: the laptop pool and a runnable pipeline; returns how to start its runner. */
export async function readyLaptopPool(
  envFile: string,
  baseURL: string,
  apps: readonly string[],
): Promise<LaptopPool> {
  const { stdout } = await run(
    process.execPath,
    [
      `--env-file=${envFile}`,
      'modules/pipelines/scripts/runner-demo.ts',
      '--url',
      baseURL,
      '--apps',
      apps.join(','),
    ],
    { cwd: REPO_ROOT },
  );
  const token = /--pool-token (\S+)/.exec(stdout)?.[1];
  if (!token) throw new Error(`demo:runner printed no pool token:\n${stdout}`);
  const allowBuildPath = /--allow-build-path (\S+)/.exec(stdout)?.[1];
  return { token, ...(allowBuildPath ? { allowBuildPath } : {}) };
}

export interface RunningRunner {
  log: string;
  stop(): Promise<void>;
}

/** A runner that runs steps as processes on this machine, as `--local` promises. */
export function startLocalRunner(baseURL: string, pool: LaptopPool): RunningRunner {
  const dataDir = statePath('runner');
  mkdirSync(dataDir, { recursive: true });
  const log = statePath('runner.log');
  const out = openSync(log, 'w');
  const child: ChildProcess = spawn(
    process.execPath,
    [
      'apps/runner/src/main.ts',
      '--url',
      baseURL,
      '--pool-token',
      pool.token,
      ...(pool.allowBuildPath ? ['--allow-build-path', pool.allowBuildPath] : []),
      '--local',
      '--name',
      'e2e-laptop',
      '--data-dir',
      dataDir,
    ],
    { cwd: REPO_ROOT, stdio: ['ignore', out, out] },
  );
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  return {
    log,
    async stop() {
      if (child.exitCode !== null) return;
      // SIGTERM drains: the runner finishes its step and hands the job back.
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 10_000);
      await exited;
      clearTimeout(timer);
    },
  };
}
