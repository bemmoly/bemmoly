import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ResolvedStep } from '@bemmoly/module-pipelines/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { StepExecutor, StepRunOptions } from '../executors/types.ts';
import { BuildExecutor, buildPathProblem } from './build-step.ts';

const buildStep = (env: Record<string, string> = {}): ResolvedStep => ({
  key: 'build',
  name: 'Build image',
  image: null,
  run: 'docker build .',
  uses: 'bemmoly/build',
  env,
  secrets: [],
  locked: true,
  origin: 'template',
  junit: null,
  artifacts: [],
});

class RecordingHost implements StepExecutor {
  calls: StepRunOptions[] = [];
  run(_step: ResolvedStep, options: StepRunOptions) {
    this.calls.push(options);
    return Promise.resolve({ exitCode: 0 });
  }
  cancel() {
    return Promise.resolve();
  }
}

describe('bemmoly/build on the host', () => {
  let base: string;
  let workspace: string;

  beforeEach(async () => {
    base = await mkdtemp(path.join(tmpdir(), 'runner-build-'));
    workspace = path.join(base, 'workspace');
    await mkdir(path.join(workspace, 'services', 'api'), { recursive: true });
    await mkdir(path.join(base, 'host-secrets'), { recursive: true });
  });

  afterEach(async () => {
    await rm(base, { recursive: true, force: true });
  });

  it('accepts a Dockerfile and context inside the repository', async () => {
    expect(await buildPathProblem(workspace, buildStep())).toBeNull();
    const nested = buildStep({
      BEMMOLY_BUILD_DOCKERFILE: 'services/api/Dockerfile',
      BEMMOLY_BUILD_CONTEXT: 'services/api',
    });
    expect(await buildPathProblem(workspace, nested)).toBeNull();
  });

  it.each<Record<string, string>>([
    { BEMMOLY_BUILD_CONTEXT: '/' },
    { BEMMOLY_BUILD_CONTEXT: '../..' },
    { BEMMOLY_BUILD_DOCKERFILE: '/etc/passwd' },
    { BEMMOLY_BUILD_DOCKERFILE: '../host-secrets/token' },
  ])('refuses a path outside the repository: %o', async (env) => {
    expect(await buildPathProblem(workspace, buildStep(env))).toMatch(/outside the repository/);
  });

  it('refuses a context the repository symlinks outside itself', async () => {
    await symlink(path.join(base, 'host-secrets'), path.join(workspace, 'context'));
    const step = buildStep({ BEMMOLY_BUILD_CONTEXT: 'context' });
    expect(await buildPathProblem(workspace, step)).toMatch(/build context context is outside/);
  });

  it('never runs the build when a path escapes, and says why', async () => {
    const host = new RecordingHost();
    const lines: string[] = [];
    const result = await new BuildExecutor(host).run(buildStep({ BEMMOLY_BUILD_CONTEXT: '/' }), {
      workspace,
      env: {},
      onLine: (line) => lines.push(line),
      label: 'job-1',
    });
    expect(result.exitCode).toBe(1);
    expect(host.calls).toHaveLength(0);
    expect(lines[0]).toMatch(/outside the repository/);
  });

  it('gives the host build none of the pipeline environment', async () => {
    const host = new RecordingHost();
    await new BuildExecutor(host).run(buildStep(), {
      workspace,
      env: { PATH: './bin', LD_PRELOAD: './evil.so', DOCKER_HOST: 'tcp://10.0.0.1:2375' },
      onLine: () => undefined,
      label: 'job-1',
    });
    expect(host.calls[0]?.env).toEqual({ CI: 'true' });
  });
});
