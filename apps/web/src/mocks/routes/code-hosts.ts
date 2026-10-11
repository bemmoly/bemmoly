import {
  createCodeHostSchema,
  updateCodeHostSchema,
  type CodeHost,
  type CodeHostDelivery,
} from '@bemmoly/shared';
import { can, type MockDb } from '../db.ts';
import { MOCK_WEBHOOK_ORIGIN, seedCodeHosts, type MockCodeHosts } from '../seed/code-hosts.ts';
import { newId } from '../seed/time.ts';
import { fail, invalid, notFound, ok, type MockRoute } from '../types.ts';

const MANAGE = 'workspace.settings.manage';

/** Code host state, made on first use so a stored mock from before it still loads. */
export function codeHostsOf(db: MockDb): MockCodeHosts {
  db.codeHosts ??= seedCodeHosts(db.scenario === 'ready' || db.scenario === 'member');
  return db.codeHosts;
}

const forbidden = () =>
  fail(403, 'forbidden', 'You need the "Manage workspace settings" capability.');
const needs =
  (handle: MockRoute['handle']): MockRoute['handle'] =>
  (request, db) =>
    can(db, MANAGE) ? handle(request, db) : forbidden();

const find = (db: MockDb, id: string | undefined) =>
  codeHostsOf(db).hosts.find((host) => host.id === id);

function record(db: MockDb, host: CodeHost, entry: Omit<CodeHostDelivery, 'id' | 'receivedAt'>) {
  const state = codeHostsOf(db);
  const delivery = { ...entry, id: newId(), receivedAt: new Date().toISOString() };
  state.deliveries[host.id] = [delivery, ...(state.deliveries[host.id] ?? [])].slice(0, 20);
  host.lastDelivery = delivery;
  host.lastError = null;
  return delivery;
}

/** Settings › Integrations › Code hosts, as the server answers it. No host is ever called. */
export const codeHostRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/admin/code-hosts',
    handle: needs((_, db) => ok({ items: codeHostsOf(db).hosts })),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/code-hosts',
    handle: needs((request, db) => {
      const parsed = createCodeHostSchema.safeParse(request.body);
      if (!parsed.success) return invalid('name', 'Check the form and try again');
      const body = parsed.data;
      const credentials = body.credentials;
      const secret = credentials.mode === 'app' ? credentials.privateKey : credentials.token;
      if (!secret) return invalid('credentials', 'Add the token or the private key');
      const id = newId();
      const now = new Date().toISOString();
      const host: CodeHost = {
        id,
        kind: body.kind,
        name: body.name,
        baseUrl: body.baseUrl,
        webhookUrl: `${MOCK_WEBHOOK_ORIGIN}/api/v1/code-hosts/${id}/webhooks`,
        authMode: credentials.mode,
        appId: credentials.mode === 'app' ? credentials.appId : null,
        installationId: credentials.mode === 'app' ? credentials.installationId : null,
        hasCredentials: true,
        hasWebhookSecret: true,
        repositories: body.repositories,
        enabled: body.enabled,
        lastDelivery: null,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      };
      codeHostsOf(db).hosts.push(host);
      return ok(host, 201);
    }),
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/admin/code-hosts/:id',
    handle: needs((request, db) => {
      const host = find(db, request.params['id']);
      if (!host) return notFound('The code host');
      const parsed = updateCodeHostSchema.safeParse(request.body);
      if (!parsed.success) return invalid('name', 'Check the form and try again');
      const body = parsed.data;
      if (body.name !== undefined) host.name = body.name;
      if (body.baseUrl !== undefined) host.baseUrl = body.baseUrl;
      if (body.repositories !== undefined) host.repositories = body.repositories;
      if (body.enabled !== undefined) host.enabled = body.enabled;
      if (body.credentials) {
        host.authMode = body.credentials.mode;
        host.appId = body.credentials.mode === 'app' ? body.credentials.appId : null;
        host.installationId =
          body.credentials.mode === 'app' ? body.credentials.installationId : null;
      }
      host.updatedAt = new Date().toISOString();
      return ok(host);
    }),
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/admin/code-hosts/:id',
    handle: needs((request, db) => {
      const state = codeHostsOf(db);
      const host = find(db, request.params['id']);
      if (!host) return notFound('The code host');
      state.hosts = state.hosts.filter((item) => item.id !== host.id);
      for (const key of Object.keys(state.links)) {
        state.links[key] = (state.links[key] ?? []).filter((link) => link.hostKind !== host.kind);
      }
      return ok();
    }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/code-hosts/:id/deliveries',
    handle: needs((request, db) => {
      const host = find(db, request.params['id']);
      return host
        ? ok({ items: codeHostsOf(db).deliveries[host.id] ?? [] })
        : notFound('The code host');
    }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/code-hosts/:id/tests',
    handle: needs((request, db) => {
      const host = find(db, request.params['id']);
      if (!host) return notFound('The code host');
      record(db, host, {
        event: 'ping',
        action: null,
        outcome: 'test',
        summary: `Ping from ${host.kind === 'github' ? 'GitHub' : 'GitLab'}`,
        error: null,
      });
      return ok(
        {
          webhook: { ok: true, message: 'A signed test delivery was verified and recorded' },
          api: host.hasCredentials
            ? { ok: true, message: 'Connected as the Bemmoly demo app' }
            : { ok: null, message: 'No API credentials are saved' },
        },
        201,
      );
    }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/code-hosts/:id/backfills',
    handle: needs((request, db) => {
      const host = find(db, request.params['id']);
      if (!host) return notFound('The code host');
      if (host.repositories.length === 0) {
        return invalid('repositories', 'Add the repositories to backfill first');
      }
      for (const repository of host.repositories) {
        record(db, host, {
          event: 'backfill',
          action: null,
          outcome: 'processed',
          summary: `Backfill read 0 requests from ${repository} · no issue matched`,
          error: null,
        });
      }
      return ok({ queued: true, repositories: host.repositories.length }, 202);
    }),
  },
];
