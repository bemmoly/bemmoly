import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDockerClient } from '../../../clients/docker.ts';
import type { DeployTarget } from '../contract.ts';
import { createLocalProvider } from './index.ts';

/*
 * A release built by our runner is a local image, bemmoly-local/<app>:<commit>, whose id is
 * the release's digest. The local provider deploys exactly that image behind the splitter.
 */

const SOCKETS = [join(homedir(), '.colima/default/docker.sock'), '/var/run/docker.sock'];
const APP = fileURLToPath(new URL('../../../../../scripts/demo/app', import.meta.url));

describe('the local provider and runner-built images', () => {
  let target: DeployTarget | undefined;
  let imageId = '';
  let skip = '';
  const environment = `built-${Date.now().toString(36)}`;
  const socket = SOCKETS.find((path) => existsSync(path));
  const docker = socket ? createDockerClient({ host: `unix://${socket}` }) : null;

  beforeAll(async () => {
    if (!docker || !(await docker.ping().catch(() => false))) {
      skip = 'Docker is not running';
      return;
    }
    // What the runner's bemmoly/build step does on this machine.
    execFileSync('docker', ['build', '-q', '-t', 'bemmoly-local/hello:c0ffee1', APP], {
      stdio: 'pipe',
    });
    imageId = execFileSync('docker', [
      'image',
      'inspect',
      '--format',
      '{{.Id}}',
      'bemmoly-local/hello:c0ffee1',
    ])
      .toString()
      .trim();
    target = {
      connection: {
        id: 'l',
        provider: 'local',
        name: 'This machine',
        layout: 'per-environment',
        boundaryRef: null,
        config: { dockerHost: `unix://${socket}`, syntheticRps: 0 },
      },
      environment: { id: 'e', key: environment, class: 'dev', region: null },
      account: null,
      application: { id: 'a', key: 'hello', runtime: 'container-service' },
    };
  }, 300_000);

  afterAll(async () => {
    const left = (await docker?.list({ 'dev.bemmoly.pipelines.environment': environment })) ?? [];
    for (const container of left) await docker?.remove(container.Id);
  });

  it('runs the image the release names, and it answers through the splitter', async (ctx) => {
    if (!target) return ctx.skip(skip);
    const targets = createLocalProvider().targets;
    if (!targets) throw new Error('The local provider has no targets');
    const release = {
      id: '00000000-0000-7000-8000-000000000001',
      version: 'c0ffee1',
      commitSha: 'c0ffee1',
      imageRepository: 'bemmoly-local/hello',
      imageDigests: { 'linux/amd64': imageId },
      resolvedConfig: {},
    };
    const { revision } = await targets.deploy(target, release);
    await targets.shift(target, { revision, percent: 100, stable: null });
    const { url } = await targets.describe(target);
    const text = await (await fetch(`${url}/`)).text();
    expect(text).toContain('hello c0ffee1');
    expect(text).toContain('built image');
  }, 120_000);
});
