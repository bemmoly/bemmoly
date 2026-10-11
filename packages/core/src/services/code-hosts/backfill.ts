import { codeHostDriver } from './registry.ts';
import {
  addressPolicyFor,
  dispatchActivities,
  linkedSummary,
  type CodeHostRuntime,
} from './runtime.ts';
import {
  claimDelivery,
  connectionOf,
  finishDelivery,
  integrationById,
  noteHostError,
} from './store.ts';

export const CODE_HOST_BACKFILL_JOB = 'code-hosts.backfill';

/** How far back a backfill reads, and how many requests per repository at most. */
export const BACKFILL_WINDOW_DAYS = 30;
export const BACKFILL_LIMIT = 100;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Links the pull or merge requests changed in the last 30 days, repository by repository,
 * through the same consumers a delivery reaches. Each repository gets its own line in the
 * delivery log; one that fails does not stop the others, and the job fails at the end so
 * the queue records it. Running it twice changes nothing the first run wrote.
 */
export async function runBackfill(
  rt: CodeHostRuntime,
  integrationId: string,
  runId: string,
  signal: AbortSignal,
): Promise<void> {
  const row = await integrationById(rt.sql, integrationId);
  if (!row.enabled) return;
  const driver = codeHostDriver(row.kind);
  const api = driver.api(connectionOf(rt.secrets, row), {
    policy: addressPolicyFor(rt, row),
    signal,
    ...(rt.fetch ? { fetch: rt.fetch } : {}),
  });
  const since = new Date(Date.now() - BACKFILL_WINDOW_DAYS * 86_400_000);
  const failures: string[] = [];
  for (const repository of row.repositories) {
    const claimed = await claimDelivery(rt.sql, {
      integrationId: row.id,
      deliveryId: `backfill:${runId}:${repository}`,
      event: 'backfill',
      action: null,
    });
    if (!claimed) continue;
    try {
      const drafts = await api.recentRequests(repository, since, BACKFILL_LIMIT);
      const result = await dispatchActivities(rt, row, drafts);
      const count = `${drafts.length} ${drafts.length === 1 ? 'request' : 'requests'}`;
      await finishDelivery(rt.sql, claimed, {
        outcome: 'processed',
        summary: linkedSummary(`Backfill read ${count} from ${repository}`, result),
      });
    } catch (error) {
      failures.push(`${repository}: ${messageOf(error)}`);
      await finishDelivery(rt.sql, claimed, {
        outcome: 'failed',
        summary: `Backfill of ${repository} failed`,
        error: messageOf(error),
      });
    }
  }
  if (failures.length > 0) {
    await noteHostError(rt.sql, row.id, `Backfill failed for ${failures.join('; ')}`.slice(0, 500));
    throw new Error(`Backfill failed for ${failures.length} of ${row.repositories.length}`);
  }
}
