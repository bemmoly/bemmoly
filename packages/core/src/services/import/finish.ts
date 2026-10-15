import { NOTIFICATION_EVENT_KINDS, type NotificationRequestedPayload } from '@bemmoly/shared';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Actor } from '../../contracts/authz.ts';
import type { EventBus } from '../../contracts/event-bus.ts';

/*
 * How a run ends, from how its containers went: all done is completed; some failed is
 * completed_with_errors, with Retry for those; none done is failed, with the first reason.
 * The admin who started it hears in their Inbox either way, so they can leave the page.
 */

const SYSTEM: Actor = { kind: 'system', id: 'imports' };

export interface RunOutcome {
  status: 'completed' | 'completed_with_errors' | 'failed';
  done: number;
  failed: number;
  error: string | null;
}

export async function outcomeOf(sql: SqlClient, jobId: string): Promise<RunOutcome> {
  const [row] = await sql<{ done: number; failed: number; error: string | null }[]>`
    select count(*) filter (where run_status = 'done')::int as done,
      count(*) filter (where run_status = 'failed')::int as failed,
      (array_agg(run_error order by position) filter (where run_status = 'failed'))[1] as error
    from import_containers where job_id = ${jobId} and selected`;
  const done = row?.done ?? 0;
  const failed = row?.failed ?? 0;
  const status = failed === 0 ? 'completed' : done === 0 ? 'failed' : 'completed_with_errors';
  return { status, done, failed, error: failed ? (row?.error ?? null) : null };
}

/** The Inbox line when a run ends; nothing when nobody started it (a script). */
export async function tellStarter(
  events: EventBus | undefined,
  job: { id: string; created_by: string | null; source: string },
  label: string,
  outcome: { status: string; done: number; failed: number; error: string | null },
  nouns: { container: string; containers: string } = { container: 'one', containers: 'of them' },
): Promise<void> {
  if (!events || !job.created_by) return;
  const body =
    outcome.status === 'completed'
      ? `All ${outcome.done} ${outcome.done === 1 ? nouns.container : nouns.containers} imported.`
      : outcome.status === 'completed_with_errors'
        ? `${outcome.done} imported, ${outcome.failed} stopped: ${outcome.error ?? 'see the report'}. Retry carries on from where it stopped.`
        : `It stopped: ${outcome.error ?? 'see the report'}. Resume carries on from where it stopped.`;
  const payload: NotificationRequestedPayload = {
    kind: 'import_finished',
    recipientIds: [job.created_by],
    target: {
      kind: 'import_job',
      id: job.id,
      label: `the import from ${label}`,
      url: `/settings/import?job=${job.id}`,
    },
    body,
    reason: 'you started this import',
    dedupeKey: `import:${job.id}:finished:${Date.now()}`,
  };
  await events.publish({
    kind: NOTIFICATION_EVENT_KINDS.notificationRequested,
    occurredAt: new Date(),
    actor: SYSTEM,
    entity: { kind: 'import_job', id: job.id },
    payload,
  });
}
