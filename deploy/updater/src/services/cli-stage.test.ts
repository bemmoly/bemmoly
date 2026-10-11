import { createHash } from 'node:crypto';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DockerClient } from '../clients/docker.ts';
import { updaterEnvSchema } from '../config/env.ts';
import { stageCli, stagedCliDir } from './cli-stage.ts';
import type { UpdaterContext } from './context.ts';

async function context(version: string | undefined, bundle = 'cli tarball bytes') {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'updater-cli-'));
  const file = path.join(dir, 'bemmoly-cli.tar.gz');
  await writeFile(file, bundle);
  const ctx: UpdaterContext = {
    env: updaterEnvSchema.parse({
      UPDATER_TOKEN: 'x'.repeat(40),
      BEMMOLY_DIR: dir,
      BEMMOLY_CLI_BUNDLE: file,
      ...(version ? { BEMMOLY_UPDATER_VERSION: version } : {}),
    }),
    docker: {} as DockerClient,
    log: () => undefined,
    now: () => new Date('2026-10-20T00:00:00Z'),
  };
  return { ctx, staged: stagedCliDir(dir) };
}

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

describe('staging the host bemmoly command (ADR 0024)', () => {
  it("leaves the image's command, its checksum and its version for the host", async () => {
    const { ctx, staged } = await context('1.3.0');
    expect(await stageCli(ctx)).toBe('staged');
    expect(await readFile(path.join(staged, 'bemmoly-cli.tar.gz'), 'utf8')).toBe(
      'cli tarball bytes',
    );
    expect(await readFile(path.join(staged, 'bemmoly-cli.tar.gz.sha256'), 'utf8')).toBe(
      `${sha('cli tarball bytes')}  bemmoly-cli.tar.gz\n`,
    );
    expect(await readFile(path.join(staged, 'VERSION'), 'utf8')).toBe('1.3.0\n');
    expect((await stat(staged)).mode & 0o777).toBe(0o755);
  });

  it('does nothing when the same release is already staged', async () => {
    const { ctx } = await context('1.3.0');
    await stageCli(ctx);
    expect(await stageCli(ctx)).toBe('current');
  });

  it("replaces an older release's staged command", async () => {
    const { ctx, staged } = await context('1.3.0');
    await stageCli(ctx);
    await writeFile(ctx.env.BEMMOLY_CLI_BUNDLE, 'newer tarball');
    const newer = { ...ctx, env: { ...ctx.env, BEMMOLY_UPDATER_VERSION: '1.4.0' } };
    expect(await stageCli(newer)).toBe('staged');
    expect(await readFile(path.join(staged, 'VERSION'), 'utf8')).toBe('1.4.0\n');
    expect(await readFile(path.join(staged, 'bemmoly-cli.tar.gz'), 'utf8')).toBe('newer tarball');
  });

  it('skips an image without a release version or without the command', async () => {
    const unversioned = await context(undefined);
    expect(await stageCli(unversioned.ctx)).toBe('skipped');
    const { ctx } = await context('1.3.0');
    const missing = { ...ctx, env: { ...ctx.env, BEMMOLY_CLI_BUNDLE: '/nowhere/cli.tar.gz' } };
    expect(await stageCli(missing)).toBe('skipped');
  });
});
