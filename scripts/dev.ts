/**
 * `pnpm dev`: start Postgres in Docker when a daemon is available, wait until it
 * is healthy, write apps/server/.env on first run, then run server and web with
 * hot reload through Turborepo.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const envPath = `${root}apps/server/.env`;
const examplePath = `${root}apps/server/.env.example`;

const DEV_VALUES: Record<string, string> = {
  DATABASE_URL: 'postgres://bemmoly:bemmoly@localhost:5432/bemmoly_db',
  BEMMOLY_SECRET_KEY: randomBytes(32).toString('base64'),
  BEMMOLY_BACKUP_PASSPHRASE: randomBytes(24).toString('base64url'),
  BEMMOLY_PUBLIC_URL: 'http://localhost:5173',
  BEMMOLY_DATA_DIR: `${root}var/data`,
  LOG_FORMAT: 'pretty',
  BEMMOLY_TRUST_PROXY: 'false',
};

function log(message: string): void {
  console.log(`[dev] ${message}`);
}

function writeEnvFile(): void {
  if (existsSync(envPath)) return;
  const lines = readFileSync(examplePath, 'utf8')
    .split('\n')
    .map((line) => {
      const key = /^([A-Z0-9_]+)=/.exec(line)?.[1];
      return key && key in DEV_VALUES ? `${key}=${DEV_VALUES[key]}` : line;
    });
  writeFileSync(envPath, lines.join('\n'), { mode: 0o600 });
  log('wrote apps/server/.env with a generated secret key (git-ignored)');
}

function startDatabase(): void {
  const daemon = spawnSync('docker', ['info'], { stdio: 'ignore' });
  if (daemon.status !== 0) {
    log('no Docker daemon found: starting without Postgres (/readyz will report it)');
    log('start Docker, OrbStack or Colima and run `pnpm dev` again to get the database');
    return;
  }
  log('starting Postgres 18 (pgvector) and waiting until it is healthy');
  const up = spawnSync(
    'docker',
    ['compose', '-f', 'docker-compose.dev.yml', 'up', '--detach', '--wait'],
    { cwd: root, stdio: 'inherit' },
  );
  if (up.status !== 0) {
    log('Postgres did not become healthy; continuing without it');
    return;
  }
  log(
    'Postgres is healthy on localhost:5432 (stop it with `docker compose -f docker-compose.dev.yml down`)',
  );
}

writeEnvFile();
startDatabase();

const turbo = spawn(
  'pnpm',
  [
    'exec',
    'turbo',
    'run',
    'dev',
    '--filter=@bemmoly/server',
    '--filter=@bemmoly/web',
    '--ui=stream',
  ],
  { cwd: root, stdio: 'inherit' },
);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => turbo.kill(signal));
}
turbo.on('exit', (code) => process.exit(code ?? 0));
