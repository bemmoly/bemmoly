import type { SqlExecutor } from '@bemmoly/core';
import type {
  ChangeEvidence,
  ChangeRequestDetail,
  ChangeRequestStep,
} from '../../../../shared/change-requests.ts';
import type { ChangeRequestItemRow, ChangeRequestRow } from '../../models/change-requests.ts';
import { compareReleases } from '../releases/compare.ts';
import { activityText } from './activity.ts';
import {
  loadDecisions,
  loadEnvironment,
  loadEvents,
  loadItems,
  loadPicks,
  loadSteps,
} from './rows.ts';
import { routeOf } from './route.ts';

/*
 * A change request as the detail screen shows it: what moves, the route with each picked
 * person's state, the evidence behind each version (the run that built it, its tests, its
 * scans), the promotions it started, its activity, and what the viewer may do now.
 */

/** No earlier release, or a person since removed. */
export const NOTHING = '00000000-0000-0000-0000-000000000000';

export const person = (id: string | null, name: string | null) => ({
  id: id ?? NOTHING,
  name: name ?? 'Someone removed',
  avatarUrl: null,
});

async function commitCount(sql: SqlExecutor, item: ChangeRequestItemRow): Promise<number> {
  const compared = await compareReleases(sql, {
    from: item.from_release_id ?? NOTHING,
    to: item.release_id,
  });
  return compared.counts.commits;
}

async function evidenceOf(
  sql: SqlExecutor,
  items: readonly ChangeRequestItemRow[],
): Promise<ChangeEvidence> {
  const releaseIds = items.map((item) => item.release_id);
  const runs = await sql<
    Array<{
      id: string;
      number: number;
      application: string;
      state: string;
      tests: { passed: number; failed: number } | null;
    }>
  >`
    select run.id, run.number::int as number, a.key as application, run.state,
      r.test_summary as tests
    from pipeline_releases r
    join pipeline_applications a on a.id = r.application_id
    left join pipeline_runs run on run.id = r.run_id
    where r.id = any(${releaseIds}::uuid[])`;
  const scans = await sql<Array<{ application: string; state: string }>>`
    select a.key as application, j.state
    from pipeline_releases r
    join pipeline_applications a on a.id = r.application_id
    join pipeline_jobs j on j.run_id = r.run_id and j.kind = 'scan'
    where r.id = any(${releaseIds}::uuid[])`;
  return {
    runs: runs
      .filter((run) => run.id)
      .map(({ id, number, application, state }) => ({ id, number, application, state })),
    tests: runs
      .filter((run) => run.tests)
      .map((run) => ({
        application: run.application,
        passed: run.tests?.passed ?? 0,
        failed: run.tests?.failed ?? 0,
      })),
    // A scan job says whether it passed; findings are counted by the scanner, not here.
    scans: scans.map((scan) => ({ ...scan, findings: 0 })),
  };
}

export async function presentDetail(
  sql: SqlExecutor,
  request: ChangeRequestRow,
  viewer: string | null,
  can: { admin: boolean },
): Promise<ChangeRequestDetail> {
  const [items, steps, picks, decisions, events, environment] = await Promise.all([
    loadItems(sql, request.id),
    loadSteps(sql, request.id),
    loadPicks(sql, request.id),
    loadDecisions(sql, request.id),
    loadEvents(sql, request.id),
    loadEnvironment(sql, { id: request.environment_id }),
  ]);
  const stepViews: ChangeRequestStep[] = steps.map((step) => ({
    position: step.position,
    group: { id: step.group_id ?? '', name: step.group_name },
    count: step.count,
    when: step.condition,
    picked: picks
      .filter((pick) => pick.step_id === step.id)
      .map((pick) => person(pick.user_id, pick.name)),
    approvals: decisions
      .filter((decision) => decision.step_id === step.id)
      .map((decision) => ({
        by: person(decision.user_id, decision.name),
        decision: decision.decision,
        note: decision.note,
        at: new Date(decision.created_at).toISOString(),
      })),
    state: step.state,
  }));
  // Draft routes come from the rule as it is now; a sent one keeps the route it was sent with.
  const rule = await routeOf(sql, environment, request.risk);
  const kept = new Set(steps.map((step) => step.position));
  const skipped = rule
    .filter((step) => !step.applies && !kept.has(step.position))
    .map((step) => ({
      group: { id: step.groupId, name: step.groupName },
      count: step.count,
      when: step.when,
    }));
  const open = steps.find((step) => step.state === 'waiting');
  const waitingOnViewer =
    request.status === 'waiting' &&
    open !== undefined &&
    viewer !== null &&
    picks.some((pick) => pick.step_id === open.id && pick.user_id === viewer) &&
    !decisions.some((decision) => decision.step_id === open.id && decision.user_id === viewer);
  const mine = viewer !== null && request.requested_by === viewer;
  const editable = request.status === 'draft' || request.status === 'changes_requested';
  return {
    id: request.id,
    number: `CHG-${request.number}`,
    title: request.title,
    why: request.why,
    risk: request.risk,
    when: request.deploy_at
      ? { kind: 'at', at: new Date(request.deploy_at).toISOString() }
      : { kind: 'asap' },
    rollback: request.rollback,
    environment: { key: request.environment_key, name: request.environment_name },
    items: await Promise.all(
      items.map(async (item) => ({
        application: { key: item.application_key, name: item.application_name },
        fromVersion: item.from_version,
        fromReleaseId: item.from_release_id,
        toVersion: item.version,
        releaseId: item.release_id,
        commitCount: await commitCount(sql, item),
      })),
    ),
    steps: stepViews,
    status: request.status as ChangeRequestDetail['status'],
    evidence: await evidenceOf(sql, items),
    requestedBy: person(request.requested_by, request.requester_name),
    emergencyReason: request.emergency_reason,
    sentAt: request.sent_at ? new Date(request.sent_at).toISOString() : null,
    createdAt: new Date(request.created_at).toISOString(),
    updatedAt: new Date(request.updated_at).toISOString(),
    activity: events.map((event) => ({
      at: new Date(event.created_at).toISOString(),
      by: event.user_id ? person(event.user_id, event.name) : null,
      text: activityText(event),
    })),
    deploys: items.flatMap((item) =>
      item.promotion_id
        ? [
            {
              promotionId: item.promotion_id,
              releaseId: item.release_id,
              application: item.application_key,
              version: item.version,
              state: item.promotion_state ?? 'requested',
            },
          ]
        : [],
    ),
    window: environment.deploy_window as ChangeRequestDetail['window'],
    skipped,
    can: {
      approve: waitingOnViewer,
      reject: waitingOnViewer,
      withdraw:
        (mine || can.admin) &&
        ['draft', 'waiting', 'changes_requested', 'approved'].includes(request.status),
      send: mine && editable,
      edit: mine && editable,
    },
  };
}
