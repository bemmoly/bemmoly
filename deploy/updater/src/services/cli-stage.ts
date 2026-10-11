import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { UpdaterContext } from './context.ts';

const RELEASE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const TARBALL = 'bemmoly-cli.tar.gz';

/** <BEMMOLY_DIR>/cli-update: where the host bemmoly command finds its next release. */
export function stagedCliDir(bemmolyDir: string): string {
  return path.join(bemmolyDir, 'cli-update');
}

export type CliStageOutcome = 'staged' | 'current' | 'skipped';

async function writeAtomic(file: string, body: string | Buffer): Promise<void> {
  await writeFile(`${file}.tmp`, body, { mode: 0o644 });
  await rename(`${file}.tmp`, file);
}

/**
 * Leaves the bemmoly command this updater's image carries in the install folder (ADR 0024).
 * The image passed the same cosign check as the app before it ran (ADR 0020), so its copy of
 * the command is as trusted as the updater itself. The updater cannot write the host's
 * /usr/local/bin; the command installs the staged copy the next time it runs as root.
 */
export async function stageCli(ctx: UpdaterContext): Promise<CliStageOutcome> {
  const version = ctx.env.BEMMOLY_UPDATER_VERSION;
  if (!version || !RELEASE.test(version)) return 'skipped';
  let tarball: Buffer;
  try {
    tarball = await readFile(ctx.env.BEMMOLY_CLI_BUNDLE);
  } catch {
    return 'skipped';
  }
  const sha256 = createHash('sha256').update(tarball).digest('hex');
  const dir = stagedCliDir(ctx.env.BEMMOLY_DIR);
  const read = (name: string) => readFile(path.join(dir, name), 'utf8').catch(() => '');
  if (
    (await read('VERSION')).trim() === version &&
    (await read(`${TARBALL}.sha256`)).startsWith(sha256)
  )
    return 'current';
  await mkdir(dir, { recursive: true });
  // Only root may write here: the command refuses a folder others can change.
  await chmod(dir, 0o755);
  await writeAtomic(path.join(dir, TARBALL), tarball);
  await writeAtomic(path.join(dir, `${TARBALL}.sha256`), `${sha256}  ${TARBALL}\n`);
  await writeAtomic(path.join(dir, 'VERSION'), `${version}\n`);
  ctx.log(`staged the bemmoly command ${version} for the host`);
  return 'staged';
}
