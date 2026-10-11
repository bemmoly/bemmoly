import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from '@bemmoly/core/config';
import {
  createIsolatedDatabase,
  startTestDatabase,
  type IsolatedDatabase,
  type TestDatabase,
} from '@bemmoly/core/testing';
import type { FetchClientMetadata } from '@bemmoly/core';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { bootApplication, type Booted } from './config/boot.ts';
import { importAvailableModules } from './config/modules.ts';

export const BOOT_ORIGIN = 'http://localhost:8080';

export interface SignedInApp {
  inject(options: InjectOptions): Promise<LightMyRequestResponse>;
  instance: Booted;
}

export interface BootHarness {
  /**
   * Boots the whole host on the shared database, signed in as the first admin. `env` adds
   * keys such as BEMMOLY_AI_RECORDING.
   */
  boot(pinned?: string, env?: Readonly<Record<string, string>>): Promise<SignedInApp>;
  stop(): Promise<void>;
}

export type BootHarnessResult =
  { available: true; harness: BootHarness } | { available: false; reason: string };

export interface BootHarnessOptions {
  /** BEMMOLY_PUBLIC_URL, and the Origin every injected request carries. */
  origin?: string;
  /** Serves MCP clients' metadata documents without a network. */
  fetchClientMetadata?: FetchClientMetadata;
}

/** Real Postgres and the real boot path, as `bemmoly` starts in production. */
export async function startBootHarness(
  options: BootHarnessOptions = {},
): Promise<BootHarnessResult> {
  const origin = options.origin ?? BOOT_ORIGIN;
  const server: TestDatabase = await startTestDatabase();
  if (!server.available) return { available: false, reason: server.reason };
  const database: IsolatedDatabase = await createIsolatedDatabase(server.url);
  const booted: Booted[] = [];
  let cookie: string | undefined;
  return {
    available: true,
    harness: {
      async boot(pinned = '', extra = {}) {
        const env = parseEnv({
          ...extra,
          DATABASE_URL: database.url,
          BEMMOLY_SECRET_KEY: Buffer.alloc(32, 8).toString('base64'),
          BEMMOLY_PUBLIC_URL: origin,
          BEMMOLY_DATA_DIR: mkdtempSync(join(tmpdir(), 'bemmoly-data-')),
          BEMMOLY_DB_CONTEXTS: 'test',
          BEMMOLY_MODULES: pinned,
          LOG_LEVEL: 'fatal',
        });
        const instance = await bootApplication({
          env,
          available: await importAvailableModules(),
          logger: false,
          ...(options.fetchClientMetadata
            ? { fetchClientMetadata: options.fetchClientMetadata }
            : {}),
        });
        booted.push(instance);
        await instance.kernel?.start();
        cookie ??= await createFirstAdmin(instance.app, origin);
        const session = cookie;
        return {
          instance,
          inject: (request: InjectOptions) =>
            instance.app.inject({
              ...request,
              headers: { origin, cookie: session, ...request.headers },
            }),
        };
      },
      async stop() {
        for (const instance of booted) await instance.app.close();
        for (const instance of booted) {
          await instance.kernel?.stop();
          await instance.database?.sql.end({ timeout: 5 });
        }
        await database.drop();
        await server.stop();
      },
    },
  };
}

/** The first admin, created through the setup wizard's endpoint; returns its session cookie. */
async function createFirstAdmin(app: FastifyInstance, origin: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/setup/admin',
    headers: { origin },
    payload: {
      workspaceName: 'Acme Labs',
      workspaceUrl: 'https://bemmoly.acmelabs.internal',
      name: 'Rohan S.',
      email: 'rohan@acmelabs.dev',
      password: 'correct horse battery',
    },
  });
  const header = response.headers['set-cookie'];
  const pair = (Array.isArray(header) ? header : [header ?? ''])
    .find((value) => value.startsWith('bemmoly_session='))
    ?.split(';')[0];
  if (response.statusCode !== 201 || !pair) throw new Error(`setup failed: ${response.body}`);
  return pair;
}
