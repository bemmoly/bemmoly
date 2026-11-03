import type { SqlClient } from '@bemmoly/core';
import { recordActivity } from './activity.ts';
import { loadEnvironment, loadItems, loadRequest } from './rows.ts';
import { settleRequest } from './settle.ts';
import { windowOpen, windowText } from './window.ts';

/*
 * Once a request is approved, the deploy starts by itself: at once, or at the time the
 * requester chose, and only inside the environment's deploy window. Each service's version
 * becomes a promotion that skips the approval gate (people already approved it) and is then
 * advanced by the shipping engine like any other. The minute sweep starts what was waiting.
 */

export interface PromotionStarter {
  promoteForChangeRequest(input: {
    release: string;
    to: string;
    changeRequestId: string;
    requestedBy: string | null;
    note: string;
  }): Promise<string>;
  engine: { advance(kind: 'promotion', id: string, force?: boolean): Promise<void> };
}

export interface DeployDeps {
  sql: SqlClient;
  now: () => Date;
  shipping?: PromotionStarter;
}

/**
 * Starts the deploy of an approved request when its time has come. `force` is an admin's
 * emergency deploy: now, whatever the window says. Returns whether it started.
 */
export async function startDeploy(
  deps: DeployDeps,
  requestId: string,
  options: { force?: boolean } = {},
): Promise<boolean> {
  const { sql } = deps;
  const now = deps.now();
  const claimed = await sql.begin(async (tx) => {
    const request = await loadRequest(tx, { id: requestId }, true);
    if (request.status !== 'approved') return null;
    const environment = await loadEnvironment(tx, { id: request.environment_id });
    if (!options.force) {
      const due = !request.deploy_at || new Date(request.deploy_at).getTime() <= now.getTime();
      if (!due) return null;
      if (!windowOpen(environment.deploy_window, now)) {
        const [said] = await tx<{ n: number }[]>`
          select count(*)::int as n from pipeline_change_request_events
          where change_request_id = ${requestId} and kind = 'waiting_for_window'`;
        if ((said?.n ?? 0) === 0) {
          await recordActivity(
            tx,
            requestId,
            null,
            'waiting_for_window',
            { until: windowText(environment.deploy_window) },
            now,
          );
        }
        return null;
      }
    }
    await tx`
      update pipeline_change_requests set status = 'deploying',
        updated_at = ${now.toISOString()}::timestamptz
      where id = ${requestId}`;
    await recordActivity(
      tx,
      requestId,
      null,
      'deploy_started',
      { environment: environment.name },
      now,
    );
    return { request, environment };
  });
  if (!claimed) return false;
  const { request, environment } = claimed;
  const started: string[] = [];
  try {
    if (!deps.shipping) throw new Error('Deploys need the database');
    for (const item of await loadItems(sql, request.id)) {
      const id = await deps.shipping.promoteForChangeRequest({
        release: item.release_id,
        to: environment.key,
        changeRequestId: request.id,
        requestedBy: request.requested_by,
        note: `CHG-${request.number}: ${request.title}`,
      });
      await sql`
        update pipeline_change_request_items set promotion_id = ${id},
          updated_at = ${now.toISOString()}::timestamptz
        where id = ${item.id}`;
      started.push(id);
    }
  } catch (error) {
    // Nothing deploys half-asked: the request says why, and the started ones carry on.
    const note = error instanceof Error ? error.message : 'The deploy could not start';
    await sql.begin(async (tx) => {
      if (started.length === 0) {
        await tx`update pipeline_change_requests set status = 'failed',
          updated_at = ${now.toISOString()}::timestamptz where id = ${request.id}`;
      }
      await recordActivity(
        tx,
        request.id,
        null,
        'failed',
        { environment: environment.name, note },
        now,
      );
    });
    if (started.length === 0) return false;
  }
  for (const id of started) await deps.shipping?.engine.advance('promotion', id, true);
  return true;
}

/** The minute sweep: approved requests whose time or window has come. */
export async function sweepApproved(deps: DeployDeps, limit = 50): Promise<number> {
  const rows = await deps.sql<{ id: string }[]>`
    select id from pipeline_change_requests
    where status = 'approved'
      and (deploy_at is null or deploy_at <= ${deps.now().toISOString()}::timestamptz)
    order by decided_at nulls first, id limit ${limit}`;
  let started = 0;
  for (const row of rows) if (await startDeploy(deps, row.id)) started += 1;
  const deploying = await deps.sql<{ id: string }[]>`
    select id from pipeline_change_requests where status = 'deploying' order by id limit ${limit}`;
  for (const row of deploying) {
    await deps.sql.begin((tx) => settleRequest(tx, row.id, deps.now()));
  }
  return started;
}
