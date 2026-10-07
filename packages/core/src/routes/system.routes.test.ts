import { ForbiddenError, isBemmolyError, systemHealthResponseSchema } from '@bemmoly/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { afterEach, describe, expect, it } from 'vitest';
import { createPgTools } from '../clients/pg-tools.ts';
import type { SqlClient } from '../clients/postgres.ts';
import { createTarTool } from '../clients/tar.ts';
import { maintenanceHook } from '../middlewares/maintenance.ts';
import { ModuleRegistry } from '../modules/registry.ts';
import { createMaintenanceReader, enterMaintenance } from '../services/system/index.ts';
import type { SystemDependencies } from '../services/system/index.ts';
import { kernelRoutes } from './index.ts';

const STATUS: Record<string, number> = {
  ValidationError: 400,
  ForbiddenError: 403,
  NotFoundError: 404,
  ConflictError: 409,
  UnauthenticatedError: 401,
  MaintenanceError: 503,
};

/** Every query fails when awaited; unawaited fragments stay inert, like postgres.js. */
const unreachableSql = (() => ({
  then: (_resolve: unknown, reject: (error: Error) => void) =>
    reject(new Error('no database in this test')),
})) as unknown as SqlClient;

async function build(options: { setupOpen?: boolean; signedIn?: boolean; allowed?: boolean }) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'bemmoly-routes-'));
  const system: SystemDependencies = {
    config: {
      databaseUrl: 'postgres://bemmoly@db:5432/bemmoly_db',
      dataDir,
      backupDir: path.join(dataDir, 'backups'),
      appVersion: '1.2.0',
      role: 'all',
      publicUrl: 'https://bemmoly.example.com',
    },
    sql: unreachableSql,
    pgTools: createPgTools({ binDir: '/nonexistent' }),
    tar: createTarTool(),
    logger: pino({ level: 'silent' }),
    authorize: async () => {
      if (!options.allowed) throw new ForbiddenError();
    },
    modules: () => [],
  };
  const app = Fastify({ trustProxy: true });
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    const status = isBemmolyError(error) ? (STATUS[error.name] ?? 500) : (error.statusCode ?? 500);
    const code = isBemmolyError(error) ? error.code : 'internal_error';
    void reply.code(status).send({ code, message: error.message, requestId: request.id });
  });
  app.addHook('onRequest', maintenanceHook(createMaintenanceReader(dataDir, 0)));
  await app.register(
    kernelRoutes({
      modules: new ModuleRegistry(),
      system: {
        system,
        setupOpen: async () => options.setupOpen ?? false,
        resolveActor: async () => {
          if (!options.signedIn) {
            throw Object.assign(new Error('Sign in first'), { statusCode: 401 });
          }
          return { kind: 'user', id: 'u1', userId: 'u1' };
        },
      },
    }),
  );
  return { app, dataDir };
}

describe('system routes', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => app?.close());

  it('serves the wizard checks anonymously while setup is open, with a fix per failing check', async () => {
    ({ app } = await build({ setupOpen: true }));
    const response = await app.inject({
      url: '/api/v1/admin/system',
      headers: { 'x-forwarded-proto': 'https', 'x-bemmoly-tls': 'internal' },
    });
    expect(response.statusCode).toBe(200);
    const body = systemHealthResponseSchema.parse(response.json());
    expect(body.checks.map((check) => check.id)).toEqual([
      'postgres',
      'disk',
      'memory',
      'smtp',
      'https',
      'backups',
    ]);
    const byId = Object.fromEntries(body.checks.map((check) => [check.id, check]));
    expect(byId['postgres']).toMatchObject({ status: 'fail', value: 'db:5432 · not reachable' });
    expect(byId['smtp']).toMatchObject({
      status: 'warn',
      value: 'not configured',
      fix: { label: 'Configure' },
    });
    expect(byId['https']).toMatchObject({
      status: 'warn',
      value: 'self-signed until DNS resolves',
    });
    for (const check of body.checks.filter((item) => item.status !== 'ok'))
      expect(check.fix).not.toBeNull();
  });

  it('requires a signed-in org admin once setup is done', async () => {
    ({ app } = await build({ signedIn: false }));
    expect((await app.inject({ url: '/api/v1/admin/system' })).statusCode).toBe(401);
    await app.close();
    ({ app } = await build({ signedIn: true, allowed: false }));
    expect((await app.inject({ url: '/api/v1/admin/updates' })).statusCode).toBe(403);
  });

  it('validates input before any service runs', async () => {
    ({ app } = await build({ signedIn: true, allowed: true }));
    const restore = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/backups/not-a-uuid/restore',
      payload: {},
    });
    expect(restore.statusCode).toBe(400);
    const apply = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/updates/apply',
      payload: { version: 'latest' },
    });
    expect(apply.statusCode).toBe(400);
    const upload = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/updates/catalog-upload?filename=../../etc/passwd',
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.from('x'),
    });
    expect(upload.statusCode).toBe(400);
  });

  it('answers the Update button with the CLI command when the install has no updater', async () => {
    ({ app } = await build({ signedIn: true, allowed: true }));
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/updates/apply',
      payload: { version: '1.3.0' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain('sudo bemmoly upgrade 1.3.0');
  });

  it('stores an air-gapped bundle without parsing it', async () => {
    let dataDir: string;
    ({ app, dataDir } = await build({ signedIn: true, allowed: true }));
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/updates/catalog-upload?filename=bemmoly-airgap-1.3.0.tar.gz',
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.from('bundle bytes'),
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      filename: 'bemmoly-airgap-1.3.0.tar.gz',
      sizeBytes: 12,
    });
    expect(dataDir).toBeTruthy();
  });

  it('refuses writes and serves the page during maintenance, but keeps probes and reads open', async () => {
    let dataDir: string;
    ({ app, dataDir } = await build({ signedIn: true, allowed: true }));
    await enterMaintenance(dataDir, {
      reason: 'restore',
      message: 'Restoring the backup from 02:00.',
      step: 'Restoring the database',
    });
    const write = await app.inject({ method: 'POST', url: '/api/v1/admin/backups', payload: {} });
    expect(write.statusCode).toBe(503);
    expect(write.json()).toMatchObject({
      code: 'maintenance',
      message: 'Restoring the backup from 02:00.',
    });
    const page = await app.inject({ url: '/projects/PLT' });
    expect(page.statusCode).toBe(503);
    expect(page.body).toContain('Restoring the database');
    expect((await app.inject({ url: '/healthz' })).statusCode).toBe(200);
  });
});
