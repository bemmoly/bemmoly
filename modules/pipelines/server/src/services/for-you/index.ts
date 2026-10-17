import type { RequestContext } from '@bemmoly/core';
import type { ForYou, ForYouQuery, WaitingApproval } from '../../../../shared/for-you.ts';
import type {
  ListPromotionsQuery,
  Promotion,
  PromotionsPage,
} from '../../../../shared/promotions.ts';
import {
  authorizePipelines,
  requireDatabase,
  requirePerson,
  type PipelinesServiceDeps,
} from '../deps.ts';
import { toJourney } from './journeys.ts';
import {
  changes,
  deployedTo,
  flaky,
  jobs,
  openPromotions,
  places,
  releases,
  shippedThisWeek,
} from './reads.ts';
import { myTeams, onCall } from './teams.ts';

/** The shipping service's approvals inbox: the promotions this person may approve now. */
export interface ApprovalsInbox {
  listPromotions(ctx: RequestContext, query: ListPromotionsQuery): Promise<PromotionsPage>;
}

function gatesSummary(promotion: Promotion): string {
  const open = promotion.gates.filter((gate) => gate.state !== 'pass');
  if (open.length === 0) return 'all gates passed';
  if (open.length === 1) return open[0]?.reason ?? '1 gate waiting';
  return `${open.length} gates waiting`;
}

/** Promotions as For you lists them; a train's departures collapse into one line. */
export function toWaiting(items: readonly Promotion[]): WaitingApproval[] {
  const trains = new Map<string, Promotion[]>();
  const out: WaitingApproval[] = [];
  for (const item of items) {
    if (item.departure) {
      trains.set(item.departure.id, [...(trains.get(item.departure.id) ?? []), item]);
      continue;
    }
    out.push({
      kind: 'promotion',
      promotionId: item.id,
      releaseId: item.release.id,
      departureId: null,
      title: item.application.name,
      application: item.application,
      version: item.release.version,
      environment: item.environment,
      requester: item.requestedBy,
      gatesSummary: gatesSummary(item),
      allGatesPassed: item.gates.every((gate) => gate.state === 'pass'),
      requestedAt: item.createdAt,
    });
  }
  for (const [departureId, list] of trains) {
    const first = list[0];
    if (!first?.departure) continue;
    out.push({
      kind: 'train',
      promotionId: null,
      releaseId: null,
      departureId,
      title: first.departure.trainName,
      application: null,
      version: `${list.length} ${list.length === 1 ? 'application' : 'applications'}`,
      environment: first.environment,
      requester: null,
      gatesSummary: gatesSummary(first),
      allGatesPassed: list.every((item) => item.gates.every((gate) => gate.state === 'pass')),
      requestedAt: first.createdAt,
    });
  }
  return out;
}

const groupBy = <T>(items: readonly T[], key: (item: T) => string) => Map.groupBy(items, key);

/**
 * Where an engineer lands: their own changes as journeys, what waits on them, their teams'
 * main and their on-call. Nothing here belongs to anyone else.
 */
export function createForYouService(deps: PipelinesServiceDeps, inbox: ApprovalsInbox) {
  return {
    async get(ctx: RequestContext, query: ForYouQuery): Promise<ForYou> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const me = requirePerson(ctx.actor);
      const tab = query.tab ?? 'in-flight';
      const [mine, waiting, teams, shift, shipped] = await Promise.all([
        changes(sql, me, tab === 'shipped' ? 7 : 3),
        inbox.listPromotions(ctx, { awaitingMe: true, limit: 10 }),
        myTeams(sql, me),
        onCall(sql, me),
        shippedThisWeek(sql, me),
      ]);
      const runIds = mine.map((change) => change.id);
      const applicationIds = [
        ...new Set(
          mine.flatMap((change) => (change.application_id ? [change.application_id] : [])),
        ),
      ];
      const [jobRows, releaseRows, placeRows, flakyRows] = await Promise.all([
        jobs(sql, runIds),
        releases(sql, runIds),
        places(sql, applicationIds),
        flaky(sql, applicationIds),
      ]);
      const releaseIds = releaseRows.map((release) => release.id);
      const [promotionRows, deployedRows] = await Promise.all([
        openPromotions(sql, releaseIds),
        deployedTo(sql, releaseIds),
      ]);
      const primary = new Map(
        mine.map((change) => [
          change.id,
          releaseRows.find(
            (release) =>
              release.run_id === change.id && release.application_id === change.application_id,
          ) ?? releaseRows.find((release) => release.run_id === change.id),
        ]),
      );
      const inputs = {
        jobs: groupBy(jobRows, (job) => job.run_id),
        releases: new Map(
          [...primary].flatMap(([run, release]) => (release ? [[run, release] as const] : [])),
        ),
        places: groupBy(placeRows, (place) => place.application_id),
        promotions: groupBy(promotionRows, (promotion) => promotion.release_id),
        flaky: new Map(flakyRows.map((row) => [row.application_id, row])),
        deployed: new Map(
          deployedRows.map((row) => [`${row.release_id}:${row.environment_id}`, row.seconds]),
        ),
      };
      const journeys = mine.map((change) => toJourney(change, inputs));
      const shippedAll = (journey: (typeof journeys)[number]) =>
        journey.stations
          .filter((station) => station.environment)
          .every((s) => s.state === 'passed');
      const inFlight = journeys.filter((journey) => !shippedAll(journey));
      return {
        journeys: tab === 'shipped' ? journeys.filter(shippedAll) : inFlight,
        counts: { inFlight: inFlight.length, shippedThisWeek: shipped },
        waitingForMe: toWaiting(waiting.items),
        myTeams: teams,
        onCall: shift,
      };
    },
  };
}

export type ForYouService = ReturnType<typeof createForYouService>;
