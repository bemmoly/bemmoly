/** Starts `astro preview` on a free port for the tests and stops it afterwards. */
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
/** The CLI entry as Astro's own manifest names it; it moved between majors. */
const astroPackage = new URL('../node_modules/astro/package.json', import.meta.url);
const { bin } = JSON.parse(readFileSync(astroPackage, 'utf8')) as { bin: { astro: string } };
const astroBin = fileURLToPath(new URL(bin.astro, astroPackage));

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

export interface Preview {
  url: string;
  stop: () => void;
}

/** Long enough for a busy CI runner, where turbo starts many tasks at once. */
const START_TIMEOUT_MS = 60_000;

export async function startPreview(): Promise<Preview> {
  const port = await freePort();
  const child: ChildProcess = spawn(
    process.execPath,
    // Astro 7 hands a locked preview to a separate server process that outlives this child;
    // without the lock it serves in-process, so stop() ends it and a running preview is untouched.
    [astroBin, 'preview', '--ignore-lock', '--port', String(port), '--host', '127.0.0.1'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let output = '';
  const keep = (chunk: Buffer) => {
    output = (output + chunk.toString()).slice(-4000);
  };
  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);
  let exited = false;
  child.once('exit', () => {
    exited = true;
  });
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline && !exited) {
    try {
      await fetch(url);
      return { url, stop: () => child.kill() };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  child.kill();
  const why = exited ? 'it exited' : `nothing answered in ${START_TIMEOUT_MS / 1000}s`;
  throw new Error(
    `astro preview did not start on ${url} (${why}); run the build first.\n${output.trim()}`,
  );
}
