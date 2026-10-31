import type { ClaimedJob, ResolvedStep } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import { createExecutors } from '../executors/index.ts';
import { buildArgFlags } from './build-args.ts';
import { kanikoCommand } from './build-kaniko.ts';
import { buildCommand } from './build-step.ts';
import { prepareStep } from './job-step.ts';

/*
 * Build args reach `docker build` and Kaniko as one quoted `--build-arg` each, so a value with
 * quotes, spaces or a command substitution stays text. Args that do not read are refused
 * before anything runs.
 */

const job = { key: 'build', repository: { commitSha: 'a1c9e3f0' } } as unknown as ClaimedJob;

const buildStep = (env: Record<string, string> = {}): ResolvedStep => ({
  key: 'build',
  name: 'Build image',
  image: null,
  run: null,
  uses: 'bemmoly/build',
  env: {
    BEMMOLY_BUILD_DOCKERFILE: 'docker/service.Dockerfile',
    BEMMOLY_BUILD_IMAGE: 'bemmoly-local/orders',
    ...env,
  },
  secrets: [],
  locked: true,
  origin: 'template',
  junit: null,
  artifacts: [],
});

const withArgs = (args: Record<string, unknown>, env: Record<string, string> = {}) =>
  buildStep({ BEMMOLY_BUILD_ARGS: JSON.stringify(args), ...env });

describe('build args on the runner', () => {
  it('quotes each value so the shell never reads it', () => {
    expect(buildArgFlags(withArgs({ SERVICE: 'orders', NOTE: `it's $(whoami) & more` }))).toBe(
      ` --build-arg 'SERVICE=orders' --build-arg 'NOTE=it'\\''s $(whoami) & more'`,
    );
    expect(buildArgFlags(buildStep())).toBe('');
  });

  it('passes them to docker build, pushed or not', () => {
    expect(buildCommand(job, withArgs({ SERVICE: 'orders' })).split(' && ')[0]).toBe(
      `docker build -f 'docker/service.Dockerfile' --build-arg 'SERVICE=orders' -t 'bemmoly-local/orders:a1c9e3f0' '.'`,
    );
    const pushed = buildCommand(
      job,
      withArgs({ SERVICE: 'orders' }, { BEMMOLY_BUILD_PUSH: 'true' }),
    );
    expect(pushed.split(' && ')[0]).toBe(
      `docker build --platform 'linux/amd64' -f 'docker/service.Dockerfile' --build-arg 'SERVICE=orders' -t 'bemmoly-local/orders:a1c9e3f0' '.'`,
    );
  });

  it('passes them to Kaniko on a pool with no Docker daemon', () => {
    expect(kanikoCommand(job, withArgs({ SERVICE: 'orders', APP_DIR: 'services/orders' }))).toBe(
      `/kaniko/executor --dockerfile "$PWD"/'docker/service.Dockerfile' --context dir://"$PWD"/'.' --build-arg 'SERVICE=orders' --build-arg 'APP_DIR=services/orders' --no-push --cleanup`,
    );
  });

  it('refuses args that do not read rather than build without them', () => {
    const executors = createExecutors({ local: true, dockerSocket: '/nowhere', hostEnv: {} });
    expect(prepareStep(job, withArgs({ 'bad name': 'x' }), executors)).toEqual({
      refusal: 'The build arg "bad name" cannot be passed on',
    });
    expect(prepareStep(job, buildStep({ BEMMOLY_BUILD_ARGS: '{not json' }), executors)).toEqual({
      refusal: 'The build args did not arrive as JSON. Run the job again',
    });
    expect(prepareStep(job, withArgs({ SERVICE: 1 }), executors)).toEqual({
      refusal: 'The build arg "SERVICE" cannot be passed on',
    });
  });
});
