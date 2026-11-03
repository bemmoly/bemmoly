import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { request } from '@playwright/test';
import { createIsolatedDatabase } from '@bemmoly/core/testing';
import { freePort, modulesCli } from './server.ts';
import { REPO_ROOT, statePath } from './state.ts';

/**
 * A second, fresh install beside the seeded one, for the setup journey: its own database on the
 * same Postgres, its own server from this checkout, Pipelines enabled, and one person, the
 * installer, who is Platform admin. Nothing else exists until the journey sets it up.
 */

export interface FreshInstall {
  baseURL: string;
  /** The installer's session. */
  storageState: string;
  stop(): Promise<void>;
}

const ADMIN = {
  name: 'Asha Installer',
  email: 'asha@fresh.example.test',
  password: 'twelve chars ok',
};

function postgresServerUrl(): string {
  const env = readFileSync(statePath('server.env'), 'utf8');
  const line = env.split('\n').find((entry) => entry.startsWith('DATABASE_URL='));
  if (!line) throw new Error('the seeded install has no DATABASE_URL');
  const url = new URL(line.slice('DATABASE_URL='.length));
  url.pathname = '/postgres';
  return url.toString();
}

async function ready(baseURL: string, log: string) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${baseURL}/readyz`)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`the fresh install was not ready within 90 s; see ${log}`);
}

async function ok(
  response: Awaited<ReturnType<Awaited<ReturnType<typeof request.newContext>>['get']>>,
  what: string,
) {
  if (!response.ok()) throw new Error(`${what}: ${response.status()} ${await response.text()}`);
}

export async function startFreshInstall(): Promise<FreshInstall> {
  const database = await createIsolatedDatabase(postgresServerUrl());
  const port = await freePort();
  const data = statePath('fresh-data');
  mkdirSync(data, { recursive: true });
  const envFile = statePath('fresh-server.env');
  const baseURL = `http://127.0.0.1:${port}`;
  const env = {
    DATABASE_URL: database.url,
    BEMMOLY_SECRET_KEY: randomBytes(32).toString('base64'),
    BEMMOLY_PUBLIC_URL: baseURL,
    BEMMOLY_DATA_DIR: data,
    BEMMOLY_BACKUP_DIR: data,
    BEMMOLY_TRUST_PROXY: 'false',
    BEMMOLY_RATE_LIMIT_PER_USER: '6000',
    BEMMOLY_RATE_LIMIT_AUTH_PER_IP: '300',
    PORT: String(port),
    LOG_LEVEL: 'warn',
  };
  writeFileSync(
    envFile,
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}\n`)
      .join(''),
  );
  const log = statePath('fresh-server.log');
  const child = spawn(process.execPath, [`--env-file=${envFile}`, 'apps/server/src/server.ts'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', openSync(log, 'w'), openSync(log, 'a')],
  });
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 10_000);
      await exited;
      clearTimeout(timer);
    }
    await database.drop().catch(() => undefined);
  };
  try {
    await ready(baseURL, log);
    await modulesCli(envFile, ['enable', 'pipelines', '--access', 'everyone']);
    const api = await request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } });
    await ok(
      await api.post('/api/v1/setup/admin', {
        data: { workspaceName: 'Fresh', workspaceUrl: baseURL, ...ADMIN },
      }),
      'setup admin',
    );
    await ok(
      await api.put('/api/v1/admin/settings/setup.completedAt', {
        data: { value: new Date().toISOString() },
      }),
      'finish setup',
    );
    // The simulated cloud stands in for Google Cloud: nothing is created anywhere.
    await ok(
      await api.put('/api/v1/admin/settings/pipelines.providers.simulate', {
        data: { value: true },
      }),
      'simulate the cloud',
    );
    const storageState = statePath('fresh-admin.json');
    await api.storageState({ path: storageState });
    await api.dispose();
    return { baseURL, storageState, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
