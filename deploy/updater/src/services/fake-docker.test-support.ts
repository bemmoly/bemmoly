import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ContainerInfo, DockerClient, ExecResult } from '../clients/docker.ts';
import { updaterEnvSchema } from '../config/env.ts';
import type { UpdaterContext } from './context.ts';

/**
 * A Docker Engine double for the updater's flows: containers by name, every call recorded,
 * and `healthy` deciding whether a started container stays running. Shared by the
 * self-update and update-flow tests; the image build deletes it with the tests.
 */
export interface FakeDocker {
  ctx: UpdaterContext;
  calls: string[];
  steps: string[];
  dir: string;
  /** Whether a container created from this image keeps running after start. */
  healthy: Map<string, boolean>;
  exec: (cmd: string[]) => ExecResult;
}

function container(id: string, name: string, image: string, service: string): ContainerInfo {
  return {
    Id: id,
    Name: `/${name}`,
    Image: `sha256:${id}`,
    Config: {
      Image: image,
      Env: ['UPDATER_TOKEN=x', 'PORT=8080'],
      Labels: { 'com.docker.compose.project': 'bemmoly', 'com.docker.compose.service': service },
    },
    HostConfig: {
      Binds: ['/var/run/docker.sock:/var/run/docker.sock'],
      NetworkMode: 'bemmoly_internal',
      ReadonlyRootfs: true,
    },
    NetworkSettings: { Networks: { bemmoly_internal: { Aliases: [service] } } },
    State: { Running: true, Restarting: false },
  } as unknown as ContainerInfo;
}

/** A cosign stand-in: a script that exits with `code`, as the real binary would. */
export async function fakeCosign(dir: string, code: number): Promise<string> {
  const file = path.join(dir, `cosign-${code}`);
  await writeFile(file, `#!/bin/sh\necho "cosign said ${code}" >&2\nexit ${code}\n`);
  await chmod(file, 0o755);
  return file;
}

export async function fakeDocker(
  env: Record<string, string> = {},
  versions: { app: string; updater: string } = { app: '1.2.0', updater: '1.2.0' },
): Promise<FakeDocker> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'updater-flow-'));
  await writeFile(
    path.join(dir, '.env'),
    `VERSION=${versions.app}\nUPDATER_VERSION=${versions.updater}\n`,
  );
  const cosign = await fakeCosign(dir, 0);
  const calls: string[] = [];
  const steps: string[] = [];
  const healthy = new Map<string, boolean>();
  const byName = new Map<string, ContainerInfo>([
    [
      'bemmoly-bemmoly-1',
      container('app1', 'bemmoly-bemmoly-1', `ghcr.io/bemmoly/bemmoly:${versions.app}`, 'bemmoly'),
    ],
    [
      'bemmoly-updater-1',
      container(
        'upd1',
        'bemmoly-updater-1',
        `ghcr.io/bemmoly/updater:${versions.updater}`,
        'updater',
      ),
    ],
  ]);
  const byId = (id: string) => [...byName.values()].find((c) => c.Id === id || c.Name === `/${id}`);
  let serial = 0;
  const fake: FakeDocker = {
    calls,
    steps,
    dir,
    healthy,
    exec: (cmd) =>
      cmd[1] === 'backup'
        ? {
            exitCode: 0,
            stdout: JSON.stringify({ id: 'b1', locations: [{ location: '/backups/b1' }] }),
            stderr: '',
          }
        : { exitCode: 0, stdout: '', stderr: '' },
    ctx: undefined as unknown as UpdaterContext,
  };
  const handle = (id: string) => ({
    stop: async () => {
      calls.push(`stop ${id}`);
      const found = byId(id);
      if (found) found.State.Running = false;
    },
    remove: async () => {
      calls.push(`remove ${id}`);
      const found = byId(id);
      if (found) byName.delete(found.Name.slice(1));
    },
    rename: async ({ name }: { name: string }) => {
      calls.push(`rename ${id} ${name}`);
      const found = byId(id);
      if (!found) return;
      byName.delete(found.Name.slice(1));
      found.Name = `/${name}`;
      byName.set(name, found);
    },
    start: async () => {
      calls.push(`start ${id}`);
      const found = byId(id);
      if (found) found.State.Running = healthy.get(found.Config.Image) ?? true;
    },
  });
  const docker = {
    raw: {
      getContainer: handle,
      createContainer: async (spec: {
        name?: string;
        Image: string;
        Cmd?: string[];
        Labels?: Record<string, string>;
      }) => {
        const id = `c${++serial}`;
        const name = spec.name ?? id;
        calls.push(`create ${name} ${spec.Image}${spec.Cmd ? ` ${spec.Cmd.join(' ')}` : ''}`);
        const service = spec.Labels?.['com.docker.compose.service'] ?? 'task';
        const made = container(id, name, spec.Image, service);
        made.State.Running = false;
        byName.set(name, made);
        return { id, start: handle(id).start };
      },
    },
    async findService(_project: string, service: string) {
      return (
        [...byName.values()].find(
          (c) =>
            c.Config.Labels?.['com.docker.compose.service'] === service &&
            !c.Name.endsWith('-previous') &&
            !c.Name.endsWith('-handoff'),
        ) ?? null
      );
    },
    inspect: async (id: string) => byId(id) ?? Promise.reject(new Error('no such container')),
    imageInfo: async (reference: string) => ({ Config: { Labels: {}, Env: [] }, Id: reference }),
    pull: async (reference: string) => {
      calls.push(`pull ${reference}`);
    },
    listImages: async () => [],
    removeImage: async () => undefined,
    exec: async (_id: string, cmd: string[]) => {
      calls.push(`exec ${cmd.slice(0, 2).join(' ')}`);
      return fake.exec(cmd);
    },
    runTask: async () => ({ exitCode: 0, stdout: '{}', stderr: '' }),
  };
  fake.ctx = {
    env: updaterEnvSchema.parse({
      UPDATER_TOKEN: 'x'.repeat(40),
      BEMMOLY_DIR: dir,
      COSIGN_BINARY: cosign,
      READY_TIMEOUT_MS: '10000',
      UPDATER_READY_TIMEOUT_MS: '5000',
      BEMMOLY_UPDATER_VERSION: versions.updater,
      ...env,
    }),
    docker: docker as unknown as DockerClient,
    log: (_message, details) => {
      if (typeof details?.['step'] === 'string') steps.push(details['step']);
    },
    now: () => new Date(),
  };
  return fake;
}

/** /readyz and /healthz answer for whatever container is running under the service name. */
export function healthFetch(fake: FakeDocker) {
  return async (url: string | URL) => {
    const target = String(url);
    const service = target.includes('/healthz') ? 'updater' : 'bemmoly';
    const live = await fake.ctx.docker.findService('bemmoly', service);
    if (!live?.State.Running) throw new Error('connect ECONNREFUSED');
    return new Response(JSON.stringify({ status: service === 'updater' ? 'ok' : 'ready' }));
  };
}
