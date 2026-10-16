import type { ModuleContext } from '@bemmoly/core';
import { z } from 'zod';
import { DISCOVERY_JOB } from '../services/discovery/index.ts';
import { INBOX_DRAIN_JOB, INBOX_SWEEP_JOB } from '../services/inbox/index.ts';
import type { PipelinesServices } from '../services/index.ts';

/*
 * What Pipelines asks of the code hosts (architecture §8): the GitHub App's write
 * permissions and events, the inbox as an event consumer, and the jobs that drain it in
 * order per repository.
 */

const PERMISSIONS = {
  checks: 'write',
  statuses: 'write',
  deployments: 'write',
  contents: 'write',
  pull_requests: 'write',
  actions: 'read',
  merge_queues: 'read',
  administration: 'read',
} as const;

const EVENTS = [
  'push',
  'pull_request',
  'merge_group',
  'check_run',
  'workflow_run',
  'repository',
  'installation_repositories',
];

const drainPayload = z.object({ repository: z.string().min(1).max(300) });

const DISCOVERY_NIGHTLY_JOB = 'pipelines.discovery-nightly';
/** Repository events that bring a repository (back) into view and so deserve a scan. */
const SCAN_ON = new Set(['created', 'added', 'renamed', 'transferred', 'unarchived']);
const RETIRE_ON = new Set(['archived', 'deleted', 'removed']);

export function registerCodeHostWork(ctx: ModuleContext, services: PipelinesServices): void {
  ctx.code.requestAppPermissions({ permissions: PERMISSIONS, events: EVENTS });
  ctx.code.addEventConsumer(services.inbox.consumer);
  const system = () => {
    if (!ctx.contextFor) throw new Error('Pipelines needs the database to process deliveries');
    return ctx.contextFor({ kind: 'system', id: 'pipelines.inbox' });
  };
  ctx.jobs.add({
    name: INBOX_DRAIN_JOB,
    // Order matters within a repository, not across them; the drain's lock keeps one per
    // repository, so several can run at once.
    concurrency: 4,
    retryLimit: 10,
    retryDelaySeconds: 5,
    async handle(payload) {
      const { repository } = drainPayload.parse(payload);
      const result = await services.inbox.drain(repository, system());
      if (result.status === 'busy') {
        await ctx.jobs.send(INBOX_DRAIN_JOB, { repository }, { startAfter: 2 });
      }
      if (result.status === 'held') throw new Error(`Held at a failing event: ${result.error}`);
    },
  });
  registerDiscoveryTriggers(ctx, services);
  ctx.jobs.add({
    name: INBOX_SWEEP_JOB,
    schedule: '* * * * *',
    singleton: true,
    async handle() {
      for (const repository of await services.inbox.waiting()) {
        await ctx.jobs.send(INBOX_DRAIN_JOB, { repository });
      }
    },
  });
}

/**
 * Discovery runs when the app is installed on a repository, on repository events and
 * nightly (architecture §9); a repository archived or removed stops being scanned.
 */
function registerDiscoveryTriggers(ctx: ModuleContext, services: PipelinesServices): void {
  const scan = (fullName: string, provider: string, defaultBranch: string | null) =>
    ctx.jobs.send(
      DISCOVERY_JOB,
      { repository: { fullName, provider, ...(defaultBranch ? { defaultBranch } : {}) } },
      // A burst of events for one repository within the hour scans it once.
      {
        idempotencyKey: `discover:${fullName.toLowerCase()}:${new Date().toISOString().slice(0, 13)}`,
      },
    );
  services.inbox.on('repository', async (event) => {
    if (SCAN_ON.has(event.action)) {
      await scan(event.repository, event.hostKind, event.defaultBranch);
    } else if (RETIRE_ON.has(event.action) && ctx.database) {
      await ctx.database`
        update pipeline_repositories set archived_at = coalesce(archived_at, now()), updated_at = now()
        where lower(full_name) = lower(${event.repository})`;
    }
  });
  ctx.jobs.add({
    name: DISCOVERY_NIGHTLY_JOB,
    schedule: '30 2 * * *',
    singleton: true,
    async handle() {
      if (!ctx.database) return;
      const rows = await ctx.database<
        { full_name: string; provider: string; default_branch: string }[]
      >`
        select full_name, provider, default_branch from pipeline_repositories
        where archived_at is null order by full_name`;
      for (const row of rows) await scan(row.full_name, row.provider, row.default_branch);
    },
  });
}
