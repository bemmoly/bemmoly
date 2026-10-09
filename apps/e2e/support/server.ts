import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, openSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { promisify } from 'node:util';
import { REPO_ROOT, statePath } from './state.ts';

const run = promisify(execFile);

/** A port nobody listens on now; the server binds it a moment later. */
export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === 'object' && address
          ? resolve(address.port)
          : reject(new Error('no port')),
      );
    });
  });
}

/**
 * The server's configuration as an env file, read by `node --env-file`, so the
 * process gets exactly these keys on top of the runner's own environment.
 */
export function writeServerEnv(databaseUrl: string, port: number): string {
  const data = statePath('data');
  const backups = statePath('backups');
  mkdirSync(data, { recursive: true });
  mkdirSync(backups, { recursive: true });
  const env = {
    DATABASE_URL: databaseUrl,
    BEMMOLY_SECRET_KEY: randomBytes(32).toString('base64'),
    BEMMOLY_PUBLIC_URL: `http://127.0.0.1:${port}`,
    BEMMOLY_DATA_DIR: data,
    BEMMOLY_BACKUP_DIR: backups,
    BEMMOLY_TRUST_PROXY: 'false',
    PORT: String(port),
    LOG_LEVEL: 'warn',
  };
  const file = statePath('server.env');
  writeFileSync(
    file,
    Object.entries(env)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(''),
  );
  return file;
}

export interface RunningServer {
  baseURL: string;
  log: string;
  stop(): Promise<void>;
}

/** The host process from this checkout, serving the built web app, as `bemmoly` runs it. */
export async function startServer(envFile: string, port: number): Promise<RunningServer> {
  const log = statePath('server.log');
  const out = openSync(log, 'w');
  const child: ChildProcess = spawn(
    process.execPath,
    [`--env-file=${envFile}`, 'apps/server/src/server.ts'],
    { cwd: REPO_ROOT, stdio: ['ignore', out, out] },
  );
  const baseURL = `http://127.0.0.1:${port}`;
  const exited = new Promise<number | null>((resolve) => child.once('exit', resolve));
  await waitUntilReady(baseURL, exited, log);
  return {
    baseURL,
    log,
    async stop() {
      if (child.exitCode !== null) return;
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 10_000);
      await exited;
      clearTimeout(timer);
    },
  };
}

async function waitUntilReady(
  baseURL: string,
  exited: Promise<number | null>,
  log: string,
): Promise<void> {
  let gone = false;
  void exited.then(() => (gone = true));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (gone) throw new Error(`The server exited while starting; see ${log}`);
    try {
      const response = await fetch(`${baseURL}/readyz`);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`The server was not ready within 60 s; see ${log}`);
}

/** The operator's CLI against the same database: `bemmoly db modules …`. */
export async function modulesCli(envFile: string, args: string[]): Promise<string> {
  const { stdout } = await run(
    process.execPath,
    [`--env-file=${envFile}`, 'apps/server/src/cli.ts', 'modules', ...args],
    { cwd: REPO_ROOT },
  );
  return stdout;
}
