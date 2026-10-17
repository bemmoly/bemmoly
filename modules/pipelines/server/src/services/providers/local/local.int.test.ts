import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createDockerClient } from '../../../clients/docker.ts';
import { describeTargetsConformance } from '../../../testing/provider-conformance.ts';
import { createLocalProvider } from './index.ts';

/*
 * The local provider against this machine's real Docker: two revisions behind a splitter,
 * traffic split between them, measured and rolled back. Skipped where no Docker socket is.
 */

const SOCKETS = [join(homedir(), '.colima/default/docker.sock'), '/var/run/docker.sock'];

const release = (version: string) => ({
  id: `00000000-0000-7000-8000-0000000000${version.replace(/\D/g, '').padStart(2, '0').slice(0, 2)}`,
  version,
  commitSha: 'a1c9e3f',
  imageRepository: null,
  imageDigests: {},
  resolvedConfig: {},
});

describeTargetsConformance('local', async () => {
  const socket = SOCKETS.find((path) => existsSync(path));
  if (!socket) return { skip: 'No Docker socket on this machine' };
  const dockerHost = `unix://${socket}`;
  const docker = createDockerClient({ host: dockerHost });
  if (!(await docker.ping().catch(() => false))) return { skip: 'Docker is not running' };
  const environment = `conformance-${Date.now().toString(36)}`;
  return {
    provider: createLocalProvider(),
    target: {
      connection: {
        id: 'local',
        provider: 'local',
        name: 'This machine',
        layout: 'per-environment',
        boundaryRef: null,
        config: { dockerHost, syntheticRps: 20 },
      },
      environment: { id: 'e', key: environment, class: 'dev', region: null },
      account: null,
      application: { id: 'a', key: 'hello', runtime: 'container-service' },
    },
    stable: release('v1'),
    next: release('v2'),
    settle: () => new Promise((resolve) => setTimeout(resolve, 6000)),
    async cleanup() {
      const left = await docker.list({ 'dev.bemmoly.pipelines.environment': environment });
      for (const container of left) await docker.remove(container.Id);
    },
  };
});
