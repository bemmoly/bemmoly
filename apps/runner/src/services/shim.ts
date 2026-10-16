import { chmod, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

/**
 * Writes <data-dir>/bin/bemmoly-runner, which runs this very runner with this very Node, so a
 * step on this machine can call `bemmoly-runner split` without an install on PATH.
 */
export async function writeShim(
  dataDir: string,
  nodePath: string,
  mainPath: string,
): Promise<string> {
  const dir = path.join(dataDir, 'bin');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, 'bemmoly-runner');
  await writeFile(file, `#!/bin/sh\nexec ${quote(nodePath)} ${quote(mainPath)} "$@"\n`);
  await chmod(file, 0o755);
  return dir;
}
