import {
  ValidationError,
  type CodeHost,
  type CodeHostBackfill,
  type CodeHostDelivery,
  type CodeHostTestResult,
  type CreateCodeHost,
  type UpdateCodeHost,
} from '@bemmoly/shared';
import type { AuditRecorder } from '../../contracts/audit.ts';
import type { Actor, Authorize } from '../../contracts/authz.ts';
import type { JobQueue } from '../../contracts/jobs.ts';
import { CODE_HOST_BACKFILL_JOB } from './backfill.ts';
import { applyDelivery } from './receive.ts';
import { codeHostDriver } from './registry.ts';
import { addressPolicyFor, type CodeHostRuntime } from './runtime.ts';
import {
  connectionOf,
  integrationById,
  lastDeliveries,
  newIntegrationId,
  openHostSecrets,
  recentDeliveries,
  toCodeHost,
  toDelivery,
  type IntegrationRow,
} from './store.ts';
import { createColumns, insertIntegration, updateColumns, updateIntegration } from './write.ts';

export interface CodeHostServiceDeps extends CodeHostRuntime {
  authorize: Authorize;
  audit: AuditRecorder;
  jobs: JobQueue;
  /** BEMMOLY_PUBLIC_URL; the webhook URL a host is given starts here. */
  publicUrl: string;
}

const workspace = { kind: 'workspace' } as const;
/** Connecting a code host stores credentials: a workspace settings change. */
const CAPABILITY = 'workspace.settings.manage';
/** The test's API call answers inside the request or says it did not. */
const TEST_TIMEOUT_MS = 10_000;
const DELIVERY_LIST_LIMIT = 20;

const userIdOf = (actor: Actor) => actor.userId ?? (actor.kind === 'user' ? actor.id : null);
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Settings › Integrations › Code hosts: connect GitHub or GitLab, see recent deliveries,
 * send a test delivery and queue a backfill. Secrets go in sealed and never come back out.
 */
export function createCodeHostService(deps: CodeHostServiceDeps) {
  const { sql } = deps;

  async function present(rows: readonly IntegrationRow[]): Promise<CodeHost[]> {
    const last = await lastDeliveries(
      sql,
      rows.map((row) => row.id),
    );
    return rows.map((row) => {
      let secrets;
      try {
        secrets = openHostSecrets(deps.secrets, row);
      } catch (error) {
        return {
          ...toCodeHost(row, { webhookSecret: '' }, deps.publicUrl, last.get(row.id)),
          lastError: messageOf(error),
        };
      }
      return toCodeHost(row, secrets, deps.publicUrl, last.get(row.id));
    });
  }

  const presentOne = async (id: string) =>
    (await present([await integrationById(sql, id)]))[0] as CodeHost;

  async function audit(
    actor: Actor,
    action: string,
    row: Pick<IntegrationRow, 'id'>,
    after?: unknown,
  ) {
    await deps.audit.record({ actor, action, target: { kind: 'integration', id: row.id }, after });
  }

  return {
    async list(actor: Actor): Promise<CodeHost[]> {
      await deps.authorize(actor, CAPABILITY, workspace);
      return present(await sql<IntegrationRow[]>`select * from integrations order by created_at`);
    },

    async get(actor: Actor, id: string): Promise<CodeHost> {
      await deps.authorize(actor, CAPABILITY, workspace);
      return presentOne(id);
    },

    async create(actor: Actor, body: CreateCodeHost): Promise<CodeHost> {
      await deps.authorize(actor, CAPABILITY, workspace);
      const id = await newIntegrationId(sql);
      const columns = createColumns(deps.secrets, id, body);
      await insertIntegration(sql, id, body.kind, columns, userIdOf(actor));
      await audit(actor, 'integration.created', { id }, { kind: body.kind, name: body.name });
      return presentOne(id);
    },

    async update(actor: Actor, id: string, body: UpdateCodeHost): Promise<CodeHost> {
      await deps.authorize(actor, CAPABILITY, workspace);
      const row = await integrationById(sql, id);
      await updateIntegration(sql, id, updateColumns(deps.secrets, row, body));
      const changed = Object.keys(body).filter(
        (key) => key !== 'webhookSecret' && key !== 'credentials',
      );
      await audit(actor, 'integration.updated', row, { changed });
      return presentOne(id);
    },

    async remove(actor: Actor, id: string): Promise<void> {
      await deps.authorize(actor, CAPABILITY, workspace);
      const row = await integrationById(sql, id);
      await sql`delete from integrations where id = ${id}`;
      await audit(actor, 'integration.deleted', row, { kind: row.kind, name: row.name });
    },

    async deliveries(actor: Actor, id: string): Promise<CodeHostDelivery[]> {
      await deps.authorize(actor, CAPABILITY, workspace);
      await integrationById(sql, id);
      return (await recentDeliveries(sql, id, DELIVERY_LIST_LIMIT)).map(toDelivery);
    },

    /**
     * A signed ping through the same path a real delivery takes (verify, claim, record), then
     * one authenticated API call when credentials are stored.
     */
    async test(actor: Actor, id: string): Promise<CodeHostTestResult> {
      await deps.authorize(actor, CAPABILITY, workspace);
      const row = await integrationById(sql, id);
      const driver = codeHostDriver(row.kind);
      const connection = connectionOf(deps.secrets, row);
      const ping = driver.ping(connection.secrets.webhookSecret);
      const verified = driver.verify(ping, connection.secrets.webhookSecret);
      const webhook = verified
        ? { ok: (await applyDelivery(deps, row, driver, ping)).outcome === 'test', message: '' }
        : { ok: false, message: '' };
      webhook.message = webhook.ok
        ? 'A signed test delivery was verified and recorded'
        : 'The stored webhook secret could not verify a test delivery';
      const hasCredentials =
        connection.authMode === 'app' ? connection.secrets.privateKey : connection.secrets.token;
      if (!hasCredentials) {
        return { webhook, api: { ok: null, message: 'No API credentials are saved' } };
      }
      try {
        const api = driver.api(connection, {
          policy: addressPolicyFor(deps, row),
          timeoutMs: TEST_TIMEOUT_MS,
          maxRetries: 0,
          ...(deps.fetch ? { fetch: deps.fetch } : {}),
        });
        return { webhook, api: { ok: true, message: await api.check() } };
      } catch (error) {
        return {
          webhook,
          api: { ok: false, message: `${driver.label} refused: ${messageOf(error)}` },
        };
      }
    },

    async backfill(actor: Actor, id: string): Promise<CodeHostBackfill> {
      await deps.authorize(actor, CAPABILITY, workspace);
      const row = await integrationById(sql, id);
      if (!row.enabled) throw new ValidationError('Turn the code host on first');
      if (row.repositories.length === 0) {
        throw new ValidationError('Add the repositories to backfill first', {
          details: { field: 'repositories' },
        });
      }
      const jobId = await deps.jobs.enqueue(
        CODE_HOST_BACKFILL_JOB,
        { integrationId: id },
        { key: `${CODE_HOST_BACKFILL_JOB}:${id}`, singleton: true },
      );
      await audit(actor, 'integration.backfill_queued', row, { repositories: row.repositories });
      return { queued: jobId !== null, repositories: row.repositories.length };
    },
  };
}

export type CodeHostService = ReturnType<typeof createCodeHostService>;
