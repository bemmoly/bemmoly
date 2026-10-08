import {
  createIdentityDependencies,
  createLocalEventBus,
  createSqlClient,
  type DomainEvent,
  type EventBus,
  type IdentityDependencies,
  type ModuleRegistry,
  type SqlClient,
} from '@bemmoly/core';
import {
  applyKernelChangelog,
  createIsolatedDatabase,
  createMemorySettings,
  resetIdentityData,
  startTestDatabase,
} from '@bemmoly/core/testing';
import { tokenOfLink } from '@bemmoly/shared';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../app.ts';
import { identityModules, TEST_ENV } from '../test-support.ts';

export const ORIGIN = TEST_ENV.BEMMOLY_PUBLIC_URL;
export const ADMIN = { email: 'rohan@acmelabs.dev', password: 'correct horse battery' };

export interface Harness {
  sql: SqlClient;
  modules: ModuleRegistry;
  identity: IdentityDependencies;
  events: DomainEvent[];
  bus: EventBus;
  app: FastifyInstance;
  /** A second app on the same database, as a second replica would be. */
  newApp(): Promise<FastifyInstance>;
  reset(): Promise<void>;
  stop(): Promise<void>;
}

export type HarnessResult =
  { available: true; harness: Harness } | { available: false; reason: string };

/** Real Postgres, the kernel changelog applied from empty, the full host app in front. */
export async function startHarness(): Promise<HarnessResult> {
  const database = await startTestDatabase();
  if (!database.available) return { available: false, reason: database.reason };
  const isolated = await createIsolatedDatabase(database.url);
  const sql = createSqlClient(isolated.url, { maxConnections: 8 });
  await applyKernelChangelog(sql);
  const bus = createLocalEventBus();
  const events: DomainEvent[] = [];
  for (const kind of ['invitation.created', 'password_reset.requested']) {
    bus.subscribe(kind, (event) => {
      events.push(event);
    });
  }
  const modules = await identityModules();
  const identity = createIdentityDependencies({
    sql,
    modules,
    events: bus,
    settings: createMemorySettings({ 'workspace.name': 'Acme Labs' }),
    publicUrl: ORIGIN,
  });
  const apps: FastifyInstance[] = [];
  const newApp = async () => {
    const app = await buildApp({ env: TEST_ENV, modules, identity, logger: false });
    apps.push(app);
    return app;
  };
  const app = await newApp();
  return {
    available: true,
    harness: {
      sql,
      modules,
      identity,
      events,
      bus,
      app,
      newApp,
      reset: async () => {
        events.length = 0;
        await resetIdentityData(sql);
      },
      stop: async () => {
        await Promise.all(apps.map((instance) => instance.close()));
        await sql.end({ timeout: 5 });
        await isolated.drop();
        await database.stop();
      },
    },
  };
}

export interface CallOptions {
  cookie?: string | undefined;
  token?: string;
  body?: unknown;
  origin?: string | null;
  headers?: Record<string, string>;
}

/** An API call as the web app makes it: same-origin, JSON, with the session cookie. */
export async function call(
  app: FastifyInstance,
  method: InjectOptions['method'],
  url: string,
  options: CallOptions = {},
): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.origin !== null) headers['origin'] = options.origin ?? ORIGIN;
  if (options.cookie) headers['cookie'] = options.cookie;
  if (options.token) headers['authorization'] = `Bearer ${options.token}`;
  return app.inject({
    method,
    url: `/api/v1${url}`,
    headers,
    ...(options.body === undefined ? {} : { payload: options.body as object }),
  });
}

/** The `name=value` pair from a response's session cookie, for the next request. */
export function sessionCookie(response: LightMyRequestResponse): string | undefined {
  const header = response.headers['set-cookie'];
  const values = Array.isArray(header) ? header : header ? [header] : [];
  const cookie = values.find((value) => value.startsWith('bemmoly_session='));
  const pair = cookie?.split(';')[0];
  return pair && pair !== 'bemmoly_session=' ? pair : undefined;
}

export async function createFirstAdmin(
  app: FastifyInstance,
): Promise<{ cookie: string; userId: string }> {
  const response = await call(app, 'POST', '/setup/admin', {
    body: {
      workspaceName: 'Acme Labs',
      workspaceUrl: 'https://bemmoly.acmelabs.internal',
      name: 'Rohan S.',
      ...ADMIN,
    },
  });
  const cookie = sessionCookie(response);
  if (response.statusCode !== 201 || !cookie) {
    throw new Error(`setup failed: ${response.statusCode} ${response.body}`);
  }
  return { cookie, userId: (response.json() as { user: { id: string } }).user.id };
}

export async function roleId(app: FastifyInstance, cookie: string, key: string): Promise<string> {
  const roles = (await call(app, 'GET', '/roles', { cookie })).json() as {
    items: { id: string; key: string }[];
  };
  const role = roles.items.find((item) => item.key === key);
  if (!role) throw new Error(`no role ${key}`);
  return role.id;
}

/** Invites and accepts in one step; returns the new person's cookie and id. */
export async function addPerson(
  harness: Harness,
  adminCookie: string,
  person: { email: string; role: string; teamId?: string },
): Promise<{ cookie: string; userId: string }> {
  const { app, events } = harness;
  const invited = await call(app, 'POST', '/invitations', {
    cookie: adminCookie,
    body: {
      emails: [person.email],
      roleId: await roleId(app, adminCookie, person.role),
      ...(person.teamId ? { teamId: person.teamId } : {}),
    },
  });
  if (invited.statusCode !== 201) throw new Error(`invite failed: ${invited.body}`);
  const event = events.findLast(
    (item) => (item.payload as { email: string }).email === person.email,
  );
  const token = linkToken((event?.payload as { acceptUrl: string }).acceptUrl);
  const accepted = await call(app, 'POST', `/auth/invitations/${token}/accept`, {
    body: { name: person.email.split('@')[0], password: 'a long enough password' },
  });
  const cookie = sessionCookie(accepted);
  if (accepted.statusCode !== 201 || !cookie) throw new Error(`accept failed: ${accepted.body}`);
  return { cookie, userId: (accepted.json() as { user: { id: string } }).user.id };
}

/** The token in an emailed link such as `/accept-invitation#token=<token>`. */
export function linkToken(url: string): string {
  return tokenOfLink(url) ?? '';
}
