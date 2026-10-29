import type { ClaimedJob, ResolvedStep, RunnerPod } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import { createExecutors } from '../executors/index.ts';
import { PodExecutor } from '../executors/pod.ts';
import { BuildExecutor } from './build-step.ts';
import { kanikoCommand, kanikoProblem } from './build-kaniko.ts';
import { prepareStep } from './job-step.ts';

/*
 * `bemmoly/build` in a pod with no Docker daemon: Kaniko builds in the pod's build container
 * from the shared workspace, pushes with the pod's identity and reports the digest the
 * finish report reads; a build for a platform the nodes are not is refused with a sentence.
 */

const job = { key: 'build', repository: { commitSha: 'a1c9e3f0' } } as unknown as ClaimedJob;

const buildStep = (env: Record<string, string> = {}): ResolvedStep => ({
  key: 'build',
  name: 'Build image',
  image: null,
  run: null,
  uses: 'bemmoly/build',
  env,
  secrets: [],
  locked: true,
  origin: 'template',
  junit: null,
  artifacts: [],
});

const pod = (builder: string | null): RunnerPod => ({
  control: '/bemmoly/control',
  logs: '/bemmoly/work/logs',
  steps: { 'alpine:3.20': 'step-0' },
  builder,
});

const executors = (builder: string | null) =>
  createExecutors({ local: false, dockerSocket: '/nowhere', hostEnv: {}, pod: pod(builder) });

describe('image builds in a runner pod', () => {
  it('pushes with Kaniko and keeps the digest it reports', () => {
    const step = buildStep({
      BEMMOLY_BUILD_PUSH: 'true',
      BEMMOLY_BUILD_IMAGE: 'europe-west1-docker.pkg.dev/acme-ci/apps/api',
      BEMMOLY_BUILD_DOCKERFILE: 'services/api/Dockerfile',
      BEMMOLY_BUILD_CONTEXT: 'services/api',
    });
    expect(kanikoProblem(step)).toBeNull();
    expect(kanikoCommand(job, step)).toBe(
      [
        'mkdir -p .bemmoly',
        `/kaniko/executor --dockerfile "$PWD"/'services/api/Dockerfile' --context dir://"$PWD"/'services/api' --destination 'europe-west1-docker.pkg.dev/acme-ci/apps/api:a1c9e3f0' --digest-file "$PWD"/.bemmoly/image-id --cleanup`,
        "test -s .bemmoly/image-id || { echo 'Kaniko did not report a digest for the pushed image'; exit 1; }",
        "printf '%s' 'linux/amd64' > .bemmoly/image-platform",
      ].join(' && '),
    );
  });

  it('checks a build that is not pushed, and refuses another platform', () => {
    expect(kanikoCommand(job, buildStep())).toBe(
      `/kaniko/executor --dockerfile "$PWD"/'Dockerfile' --context dir://"$PWD"/'.' --no-push --cleanup`,
    );
    expect(
      kanikoProblem(
        buildStep({ BEMMOLY_BUILD_PUSH: 'true', BEMMOLY_BUILD_PLATFORMS: 'linux/arm64' }),
      ),
    ).toBe(
      'Image builds on this pool run on linux/amd64 nodes, so they cannot build for linux/arm64. Build it on machines you start, or on Cloud Build',
    );
  });

  it('sends builds to the build container and run steps to their image container', () => {
    const prepared = prepareStep(job, buildStep(), executors('build'));
    if ('refusal' in prepared) throw new Error(prepared.refusal);
    expect(prepared.executor).toBeInstanceOf(BuildExecutor);
    expect(prepared.step.run).toMatch(/^\/kaniko\/executor /);
    const run = prepareStep(
      job,
      { ...buildStep(), uses: null, run: 'echo hi' },
      executors('build'),
    );
    if ('refusal' in run) throw new Error(run.refusal);
    expect(run.executor).toBeInstanceOf(PodExecutor);
    expect(prepareStep(job, buildStep(), executors(null))).toEqual({
      refusal:
        'This pod has no container for image builds. Run the job again, so its pod is made for its steps',
    });
  });
});
