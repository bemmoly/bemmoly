/** Starts `astro preview` on a free port for the tests and stops it afterwards. */
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const astroBin = fileURLToPath(new URL('../node_modules/astro/astro.js', import.meta.url));

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

export async function startPreview(): Promise<Preview> {
  const port = await freePort();
  const child: ChildProcess = spawn(
    process.execPath,
    [astroBin, 'preview', '--port', String(port), '--host', '127.0.0.1'],
    { cwd: root, stdio: 'ignore' },
  );
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await fetch(url);
      return { url, stop: () => child.kill() };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  child.kill();
  throw new Error(`astro preview did not start on ${url}; run the build first.`);
}
