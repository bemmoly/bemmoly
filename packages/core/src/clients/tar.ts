import { Readable, type Writable } from 'node:stream';
import { runProcess } from './process.ts';

const HOUR_MS = 60 * 60 * 1_000;

export interface TarOptions {
  /** Absolute path of the tar binary; present in the image and on every supported host. */
  binary?: string;
  timeoutMs?: number;
}

/** Archives and extracts attachment files with the system tar, never through a shell. */
export interface TarTool {
  /** Writes an uncompressed archive of `files` (relative to `root`) to `into`. */
  create(root: string, files: readonly string[], into: Writable): Promise<void>;
  /**
   * Extracts an archive read from `from` into `root`. Attachments are content-addressed,
   * so overwriting an existing file writes the same bytes.
   */
  extract(from: Readable, root: string): Promise<void>;
}

export function createTarTool(options: TarOptions = {}): TarTool {
  const binary = options.binary ?? '/usr/bin/tar';
  const timeoutMs = options.timeoutMs ?? 6 * HOUR_MS;
  return {
    async create(root, files, into) {
      const list = Readable.from([files.map((file) => `${file}\n`).join('')]);
      await runProcess(binary, ['-c', '-f', '-', '-C', root, '-T', '-'], {
        timeoutMs,
        stdin: list,
        stdout: into,
      });
    },
    async extract(from, root) {
      await runProcess(binary, ['-x', '-f', '-', '-C', root, '--no-same-owner'], {
        timeoutMs,
        stdin: from,
      });
    },
  };
}
