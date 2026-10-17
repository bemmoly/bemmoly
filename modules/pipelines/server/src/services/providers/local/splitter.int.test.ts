import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createDockerClient, publishedPort } from '../../../clients/docker.ts';
import type { DeployTarget } from '../contract.ts';
import { createLocalRuntime, localConfig, splitterName } from './runtime.ts';

/*
 * The splitter's admin port against this machine's real Docker: every revision on the local
 * network can reach it, so it answers only the control plane. Skipped where no Docker is.
 */

const socket = [join(homedir(), '.colima/default/docker.sock'), '/var/run/docker.sock'].find(
  (path) => existsSync(path),
);
const dockerHost = socket ? `unix://${socket}` : null;
const docker = dockerHost ? createDockerClient({ host: dockerHost }) : null;
const available = Boolean(docker && (await docker.ping().catch(() => false)));
const environment = `splitter-${Date.now().toString(36)}`;

const target = {
  connection: {
    id: 'local',
    provider: 'local',
    name: 'This machine',
    layout: 'per-environment',
    boundaryRef: null,
    config: { dockerHost, syntheticRps: 0 },
  },
  environment: { id: 'e', key: environment, class: 'dev', region: null },
  account: null,
  application: { id: 'a', key: 'hello', runtime: 'container-service' },
} as unknown as DeployTarget;

afterAll(async () => {
  if (!docker || !available) return;
  const left = await docker.list({ 'dev.bemmoly.pipelines.environment': environment });
  for (const container of left) await docker.remove(container.Id);
});

describe.skipIf(!available)('the local traffic splitter', () => {
  it('answers its admin port only with the token the control plane holds', async () => {
    const runtime = createLocalRuntime(localConfig(target.connection.config));
    const { client } = await runtime.splitter(target);
    expect(await client.routes()).toEqual([]);

    const found = await runtime.docker.inspect(splitterName(target));
    const admin = found ? publishedPort(found, 8081) : null;
    const anonymous = await fetch(`http://127.0.0.1:${admin}/routes`, {
      method: 'PUT',
      body: JSON.stringify({ routes: [{ revision: 'x', upstream: 'http://evil', percent: 100 }] }),
    });
    expect(anonymous.status).toBe(401);
    const forged = await fetch(`http://127.0.0.1:${admin}/routes`, {
      headers: { authorization: 'Bearer not-the-token' },
    });
    expect(forged.status).toBe(401);
    expect(await client.routes()).toEqual([]);
  });
});
