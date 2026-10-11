import type { Logger } from 'pino';
import { z } from 'zod';
import type { Database } from '../../clients/drizzle.ts';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Authorize } from '../../contracts/authz.ts';
import type { JobQueue } from '../../contracts/jobs.ts';
import type { CodeActivityConsumer } from '../../modules/code.ts';
import type { FromModule } from '../../modules/registry.ts';
import { createAuditRecorder } from '../audit/index.ts';
import { createRequestAuthorization, type ModuleCatalog } from '../authz/index.ts';
import type { SecretBox } from '../settings/index.ts';
import { CODE_HOST_BACKFILL_JOB, runBackfill } from './backfill.ts';
import { receiveWebhook } from './receive.ts';
import type { CodeHostRuntime } from './runtime.ts';
import { createCodeHostService, type CodeHostService } from './service.ts';
import type { WebhookRequest } from './types.ts';

export interface CodeHostWiring {
  sql: SqlClient;
  db: Database;
  /** Enabled modules, for the system context's authorization. */
  catalog: ModuleCatalog;
  modules: { codeConsumers(): FromModule<CodeActivityConsumer>[] };
  isEnabled: (moduleId: string) => boolean;
  jobs: JobQueue;
  secrets: SecretBox;
  authorize: Authorize;
  publicUrl: string;
  allowPrivateUrls: boolean;
  fetch?: typeof fetch;
  logger?: Pick<Logger, 'info' | 'warn' | 'error'>;
}

export interface CodeHosts {
  service: CodeHostService;
  /** The anonymous webhook route's handler: verify, then apply once. */
  receive(integrationId: string, request: WebhookRequest): ReturnType<typeof receiveWebhook>;
  /** Runs one backfill now, as the queue would; for tests. */
  backfill(integrationId: string, runId: string, signal?: AbortSignal): Promise<void>;
}

const payloadSchema = z.object({ integrationId: z.uuid() });

/** Builds the code host service, the webhook receiver and the backfill job. */
export function wireCodeHosts(wiring: CodeHostWiring): CodeHosts {
  const runtime: CodeHostRuntime = {
    sql: wiring.sql,
    secrets: wiring.secrets,
    consumers: () =>
      wiring.modules.codeConsumers().filter((consumer) => wiring.isEnabled(consumer.moduleId)),
    systemContext: (actorId) => ({
      actor: { kind: 'system', id: actorId },
      authz: createRequestAuthorization({ db: wiring.db, modules: wiring.catalog }),
    }),
    allowPrivateUrls: wiring.allowPrivateUrls,
    ...(wiring.fetch ? { fetch: wiring.fetch } : {}),
    ...(wiring.logger ? { logger: wiring.logger } : {}),
  };
  const service = createCodeHostService({
    ...runtime,
    authorize: wiring.authorize,
    audit: createAuditRecorder(wiring.sql),
    jobs: wiring.jobs,
    publicUrl: wiring.publicUrl,
  });
  wiring.jobs.register(
    CODE_HOST_BACKFILL_JOB,
    async (payload, ctx) =>
      runBackfill(runtime, payloadSchema.parse(payload).integrationId, ctx.jobId, ctx.signal),
    // The client already backs off inside a run; a failed run is recorded, not retried.
    { retryLimit: 0, expireInSeconds: 30 * 60 },
  );
  return {
    service,
    receive: (integrationId, request) => receiveWebhook(runtime, integrationId, request),
    backfill: (integrationId, runId, signal) =>
      runBackfill(runtime, integrationId, runId, signal ?? new AbortController().signal),
  };
}
