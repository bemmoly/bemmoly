import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ClaimedJob, ResolvedStep } from '@bemmoly/module-pipelines/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IMAGE_ID_FILE, IMAGE_PLATFORM_FILE, buildCommand, pushPlatform } from './build-step.ts';

/*
 * The push variant of `bemmoly/build` runs the real shell command against a stand-in docker
 * CLI: what the runner reports as the image is whatever digest the registry answered with.
 */

const run = promisify(execFile);
const DIGEST = `sha256:${'a1'.repeat(32)}`;

const job = { key: 'build', repository: { commitSha: 'a1c9e3f0' } } as unknown as ClaimedJob;

const step = (env: Record<string, string>): ResolvedStep => ({
  key: 'build',
  name: 'Build image',
  image: null,
  run: null,
  uses: 'bemmoly/build',
  env: { BEMMOLY_BUILD_IMAGE: 'us-central1-docker.pkg.dev/acme/apps/checkout-api', ...env },
  secrets: [],
  locked: true,
  origin: 'template',
  junit: null,
  artifacts: [],
});

describe('bemmoly/build pushing to a registry', () => {
  let base: string;
  let calls: string;

  beforeEach(async () => {
    base = await mkdtemp(path.join(tmpdir(), 'runner-push-'));
    calls = path.join(base, 'calls.log');
    await mkdir(path.join(base, 'bin'));
    const docker = path.join(base, 'bin', 'docker');
    // Answers like docker: a push ends with "<tag>: digest: sha256:… size: …".
    await writeFile(
      docker,
      [
        '#!/bin/sh',
        `echo "$@" >> '${calls}'`,
        'if [ "$1" = push ]; then',
        '  [ -n "$FAIL_PUSH" ] && { echo "denied: permission"; exit 1; }',
        '  echo "The push refers to repository [$2]"',
        `  echo "a1c9e3f0: digest: ${DIGEST} size: 1574"`,
        'fi',
        'exit 0',
      ].join('\n'),
    );
    await chmod(docker, 0o755);
  });

  afterEach(async () => {
    await rm(base, { recursive: true, force: true });
  });

  const shell = (command: string, env: Record<string, string> = {}) =>
    run('sh', ['-c', command], {
      cwd: base,
      env: { PATH: `${path.join(base, 'bin')}:/usr/bin:/bin`, ...env },
    });

  it('builds for the deploy platform, pushes, and reports the registry digest', async () => {
    await shell(buildCommand(job, step({ BEMMOLY_BUILD_PUSH: 'true' })));
    expect((await readFile(path.join(base, IMAGE_ID_FILE), 'utf8')).trim()).toBe(DIGEST);
    expect(await readFile(path.join(base, IMAGE_PLATFORM_FILE), 'utf8')).toBe('linux/amd64');
    const log = await readFile(calls, 'utf8');
    expect(log).toContain(
      'build --platform linux/amd64 -f Dockerfile -t us-central1-docker.pkg.dev/acme/apps/checkout-api:a1c9e3f0 .',
    );
    expect(log).toContain('push us-central1-docker.pkg.dev/acme/apps/checkout-api:a1c9e3f0');
  });

  it('fails the step, with the registry’s answer in the log, when the push is refused', async () => {
    const failed = shell(buildCommand(job, step({ BEMMOLY_BUILD_PUSH: 'true' })), {
      FAIL_PUSH: '1',
    });
    await expect(failed).rejects.toMatchObject({ stdout: expect.stringContaining('denied') });
  });

  it('keeps the local image id when there is nowhere to push', () => {
    expect(buildCommand(job, step({}))).not.toContain('docker push');
  });

  it('builds for exactly one platform, the first the pipeline names', () => {
    expect(pushPlatform(step({ BEMMOLY_BUILD_PLATFORMS: 'linux/arm64,linux/amd64' }))).toBe(
      'linux/arm64',
    );
    expect(pushPlatform(step({ BEMMOLY_BUILD_PLATFORMS: '$(rm -rf /)' }))).toBe('linux/amd64');
  });
});
