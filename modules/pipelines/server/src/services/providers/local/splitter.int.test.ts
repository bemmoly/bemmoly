import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createDockerClient, publishedPort } from '../../../clients/docker.ts';
import type { DeployTarget } from '../contract.ts';
import { SPLITTER_PROGRAM } from './programs.ts';
import { createLocalRuntime, localConfig, NETWORK, splitterName } from './runtime.ts';

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

  it('refuses every admin call when started without a token, and is replaced by one with', async () => {
    const legacy = { ...target, application: { ...target.application, key: 'legacy' } };
    const runtime = createLocalRuntime(localConfig(target.connection.config));
    const name = splitterName(legacy);
    await runtime.docker.ensureNetwork(NETWORK, { 'dev.bemmoly.pipelines': 'true' });
    await runtime.docker.create({
      name,
      image: localConfig(target.connection.config).nodeImage,
      cmd: ['node', '-e', SPLITTER_PROGRAM],
      env: { LOAD_RPS: '0' },
      labels: { 'dev.bemmoly.pipelines.environment': environment },
      network: NETWORK,
      publish: [8080, 8081],
    });
    await runtime.docker.start(name);
    const tokenless = await runtime.docker.inspect(name);
    const admin = tokenless ? publishedPort(tokenless, 8081) : null;
    let status = 0;
    for (let attempt = 0; attempt < 40 && status === 0; attempt += 1) {
      status = await fetch(`http://127.0.0.1:${admin}/routes`)
        .then((response) => response.status)
        .catch(async () => {
          await new Promise((resolve) => setTimeout(resolve, 250));
          return 0;
        });
    }
    expect(status).toBe(401);

    const { client } = await runtime.splitter(legacy);
    expect(await client.routes()).toEqual([]);
    const replaced = await runtime.docker.inspect(name);
    expect(replaced?.Config.Env?.some((line) => /^ADMIN_TOKEN=.+/.test(line))).toBe(true);
  });
});
