import type { ModuleContext } from '@bemmoly/core';
import { z } from 'zod';
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
