import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ContainerInfo, DockerClient, ImageInfo } from '../clients/docker.ts';
import { updaterEnvSchema } from '../config/env.ts';
import { cloneSpec, taskSpec, versionOf } from './container-spec.ts';
import type { UpdaterContext } from './context.ts';
import { imageFor, pruneImages, verifyImage } from './images.ts';
import { renderProgressPage } from './progress-page.ts';
import { acquireLock, IDLE, writeVersion } from './state.ts';

const container = {
  Id: 'abc123def456',
  Name: '/bemmoly-bemmoly-1',
  Image: 'sha256:old',
  Config: {
    Image: 'ghcr.io/bemmoly/bemmoly:1.2.0',
    Hostname: 'abc123def456',
    Env: ['DATABASE_URL=postgres://db/bemmoly_db', 'BEMMOLY_VERSION=1.2.0', 'PATH=/usr/bin'],
    Labels: {
      'com.docker.compose.service': 'bemmoly',
      'org.opencontainers.image.version': '1.2.0',
    },
    Cmd: ['serve'],
    Entrypoint: ['tini', '--', 'bemmoly-entrypoint'],
    User: 'bemmoly',
    WorkingDir: '/app',
  },
  HostConfig: { Binds: ['/var/bemmoly/data:/var/bemmoly/data'], NetworkMode: 'bemmoly_internal' },
  NetworkSettings: {
    Networks: { bemmoly_internal: { Aliases: ['bemmoly-bemmoly-1', 'bemmoly', 'abc123def456'] } },
  },
} as unknown as ContainerInfo;

const oldImage = {
  Config: {
    Env: ['BEMMOLY_VERSION=1.2.0', 'PATH=/usr/bin'],
    Labels: { 'org.opencontainers.image.version': '1.2.0' },
    Cmd: ['serve'],
    Entrypoint: ['tini', '--', 'bemmoly-entrypoint'],
    User: 'bemmoly',
    WorkingDir: '/app',
  },
} as unknown as ImageInfo;

describe('cloneSpec', () => {
  it('keeps what Compose set and drops what the old image supplied', () => {
    const spec = cloneSpec(container, oldImage, 'ghcr.io/bemmoly/bemmoly:1.3.0');
    expect(spec.Image).toBe('ghcr.io/bemmoly/bemmoly:1.3.0');
    expect(spec.Env).toEqual(['DATABASE_URL=postgres://db/bemmoly_db']);
    expect(spec.Labels).toEqual({ 'com.docker.compose.service': 'bemmoly' });
    expect(spec.Cmd).toBeUndefined();
    expect(spec.Entrypoint).toBeUndefined();
    expect(spec.Hostname).toBeUndefined();
    expect(spec.NetworkingConfig?.EndpointsConfig?.['bemmoly_internal']?.Aliases).toEqual([
      'bemmoly-bemmoly-1',
      'bemmoly',
    ]);
    expect(spec.HostConfig?.Binds).toEqual(['/var/bemmoly/data:/var/bemmoly/data']);
  });

  it('builds task containers with the same env, mounts and network', () => {
    const task = taskSpec(container, oldImage, 'ghcr.io/bemmoly/bemmoly:1.2.0', [
      'bemmoly-system',
      'status',
    ]);
    expect(task).toMatchObject({
      Cmd: ['bemmoly-system', 'status'],
      Env: ['DATABASE_URL=postgres://db/bemmoly_db'],
      HostConfig: {
        NetworkMode: 'bemmoly_internal',
        Binds: ['/var/bemmoly/data:/var/bemmoly/data'],
      },
    });
  });

  it('reads the running version from the tag, else the OCI label', () => {
    expect(versionOf(container, oldImage)).toBe('1.2.0');
    const latest = {
      ...container,
      Config: { ...container.Config, Image: 'ghcr.io/bemmoly/bemmoly:latest' },
    };
    expect(versionOf(latest as ContainerInfo, oldImage)).toBe('1.2.0');
  });
});

function context(
  overrides: Record<string, string> = {},
  docker: Partial<DockerClient> = {},
): UpdaterContext {
  return {
    env: updaterEnvSchema.parse({ UPDATER_TOKEN: 'x'.repeat(40), ...overrides }),
    docker: docker as DockerClient,
    log: () => undefined,
    now: () => new Date('2026-10-20T00:00:00Z'),
  };
}

describe('images', () => {
  it('only ever names the official repository with a release version', () => {
    expect(imageFor(context(), '1.3.0')).toBe('ghcr.io/bemmoly/bemmoly:1.3.0');
    expect(() => imageFor(context(), 'evil.example/image:1')).toThrow(/not a release version/);
  });

  it('refuses unverifiable images unless unsigned updates are allowed', async () => {
    const local = context({ BEMMOLY_UPDATER_LOCAL_IMAGES: 'true' });
    await expect(verifyImage(local, 'ghcr.io/bemmoly/bemmoly:1.3.0')).rejects.toThrow(
      /BEMMOLY_ALLOW_UNSIGNED_UPDATES/,
    );
    const allowed = context({
      BEMMOLY_UPDATER_LOCAL_IMAGES: 'true',
      BEMMOLY_ALLOW_UNSIGNED_UPDATES: 'true',
    });
    await expect(verifyImage(allowed, 'ghcr.io/bemmoly/bemmoly:1.3.0')).resolves.toBe('local');
    const noCosign = context({ COSIGN_BINARY: '/nonexistent/cosign' });
    await expect(verifyImage(noCosign, 'ghcr.io/bemmoly/bemmoly:1.3.0')).rejects.toThrow(
      /cosign is not available/,
    );
  });

  it('keeps the running and previous images and removes old ones', async () => {
    const removed: string[] = [];
    const day = 86_400;
    const now = Date.parse('2026-10-20T00:00:00Z') / 1000;
    const ctx = context(
      {},
      {
        listImages: async () =>
          [
            { RepoTags: ['ghcr.io/bemmoly/bemmoly:1.3.0'], Created: now - 2 * day },
            { RepoTags: ['ghcr.io/bemmoly/bemmoly:1.2.0'], Created: now - 30 * day },
            { RepoTags: ['ghcr.io/bemmoly/bemmoly:1.1.0'], Created: now - 60 * day },
            { RepoTags: ['ghcr.io/bemmoly/bemmoly:1.0.0'], Created: now - 1 * day },
          ] as never,
        removeImage: async (reference: string) => {
          removed.push(reference);
        },
      },
    );
    const state = {
      ...IDLE,
      current: '1.3.0',
      previous: '1.2.0',
      updatedAt: '2026-10-18T00:00:00Z',
    };
    expect(await pruneImages(ctx, state)).toEqual(['ghcr.io/bemmoly/bemmoly:1.1.0']);
    // Once the rollback window closes, the previous image goes too.
    const later = { ...state, updatedAt: '2026-10-01T00:00:00Z' };
    removed.length = 0;
    expect(await pruneImages(ctx, later)).toContain('ghcr.io/bemmoly/bemmoly:1.2.0');
  });
});

describe('state', () => {
  it('rewrites VERSION in .env in place', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'updater-'));
    await writeFile(
      path.join(dir, '.env'),
      'BEMMOLY_SECRET_KEY=abc\nVERSION=1.2.0\nPOSTGRES_PASSWORD=x\n',
    );
    await writeVersion(dir, '1.3.0');
    expect(await readFile(path.join(dir, '.env'), 'utf8')).toBe(
      'BEMMOLY_SECRET_KEY=abc\nVERSION=1.3.0\nPOSTGRES_PASSWORD=x\n',
    );
  });

  it('lets one operation run at a time', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'updater-'));
    const release = await acquireLock(dir);
    await expect(acquireLock(dir)).rejects.toThrow(/Another update or rollback/);
    await release();
    await (
      await acquireLock(dir)
    )();
  });

  it('shows the step on the progress page without leaking details', () => {
    const html = renderProgressPage({
      ...IDLE,
      state: 'running',
      operation: 'update',
      step: 'health',
      message: 'secret detail',
    });
    expect(html).toContain('Waiting for it to answer');
    expect(html).not.toContain('secret detail');
  });
});
