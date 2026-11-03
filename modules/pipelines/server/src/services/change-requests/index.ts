import type { EventBus, RequestContext, SqlClient } from '@bemmoly/core';
import type {
  ChangeRequestDetail,
  ChangeRequestsPage,
  CreateChangeRequestBody,
  ListChangeRequestsQuery,
  UpdateChangeRequestBody,
} from '../../../../shared/change-requests.ts';
import type {
  ChangeRequestOptions,
  ChangeRequestOptionsQuery,
} from '../../../../shared/change-request-options.ts';
import { authorizePipelines, PIPELINES_RESOURCE, personOf, requirePerson } from '../deps.ts';
import { notify, recordActivity } from './activity.ts';
import { approve, reject, withdraw } from './decide.ts';
import { startDeploy, sweepApproved, type PromotionStarter } from './deploy.ts';
import { listChangeRequests } from './list.ts';
import { changeRequestOptions } from './options.ts';
import { presentDetail } from './present.ts';
import { groupMembers, loadEnvironment, loadItems, loadRequest } from './rows.ts';
import {
  announceSent,
  insertRequest,
  prepare,
  requireDeployer,
  requireEditable,
  storedPicks,
  writeChildren,
  type Draft,
} from './write.ts';
import { resolveItems } from './items.ts';

export { settleChangeRequest } from './settle.ts';

/*
 * Change requests (product rule 5) behind /api/v1/pipelines/change-requests: write one as a
 * draft or send it, decide on it step by step, withdraw it, and an admin's emergency deploy.
 * The last approval starts the deploy by itself through shipping; the minute sweep starts
 * what waited for its time or window and settles what finished.
 */

export interface ChangeRequestsDeps {
  sql: SqlClient;
  now: () => Date;
  shipping?: PromotionStarter;
  events?: Pick<EventBus, 'publish'>;
}

export function createChangeRequestsService(deps: ChangeRequestsDeps) {
  const { sql } = deps;
  const isAdmin = (ctx: RequestContext) =>
    ctx.authz.can(ctx.actor, 'pipelines.platform.admin', PIPELINES_RESOURCE);

  async function detail(ctx: RequestContext, id: string): Promise<ChangeRequestDetail> {
    const request = await loadRequest(sql, { id });
    return presentDetail(sql, request, personOf(ctx.actor), { admin: await isAdmin(ctx) });
  }

  /** Tries the deploy at once; a closed window or a later time leaves it to the sweep. */
  async function deployIfApproved(id: string) {
    await startDeploy(deps, id);
  }

  async function emergency(ctx: RequestContext, body: CreateChangeRequestBody, reason: string) {
    await authorizePipelines(ctx, 'pipelines.platform.admin');
    const requester = requirePerson(ctx.actor);
    const environment = await loadEnvironment(sql, { key: body.environment });
    const items = await resolveItems(sql, environment, body.items);
    const now = deps.now();
    const at = now.toISOString();
    const id = await sql.begin(async (tx) => {
      const request = await insertRequest(tx, environment, body, requester, 'approved', at);
      await writeChildren(tx, request.id, { items, picks: [] }, false, at);
      await recordActivity(tx, request.id, requester, 'emergency', { note: reason }, now);
      // Everyone who could have approved it hears that it went without them.
      const groups = (environment.approval_rule?.steps ?? []).map((step) => step.group);
      const approvers = (await Promise.all(groups.map((g) => groupMembers(tx, g)))).flat();
      await notify(
        deps,
        ctx,
        tx,
        { ...request, title: body.title },
        {
          kind: 'pipelines.emergency_deploy',
          recipientIds: approvers.map((member) => member.id),
          body: `Deployed to ${environment.name} without approval: ${reason}`,
          dedupeKey: `change-request:${request.id}:emergency`,
        },
      );
      return request.id;
    });
    await startDeploy(deps, id, { force: true });
    return detail(ctx, id);
  }

  return {
    async list(ctx: RequestContext, query: ListChangeRequestsQuery): Promise<ChangeRequestsPage> {
      await authorizePipelines(ctx);
      return listChangeRequests(sql, query, requirePerson(ctx.actor));
    },

    async get(ctx: RequestContext, number: string): Promise<ChangeRequestDetail> {
      await authorizePipelines(ctx);
      const request = await loadRequest(sql, { number });
      // A draft is its writer's until it is sent.
      if (request.status === 'draft' && request.requested_by !== personOf(ctx.actor)) {
        await authorizePipelines(ctx, 'pipelines.platform.admin');
      }
      return detail(ctx, request.id);
    },

    async options(
      ctx: RequestContext,
      query: ChangeRequestOptionsQuery,
    ): Promise<ChangeRequestOptions> {
      await authorizePipelines(ctx);
      return changeRequestOptions(sql, query, requirePerson(ctx.actor), await isAdmin(ctx));
    },

    async create(ctx: RequestContext, body: CreateChangeRequestBody) {
      if (body.emergency) return emergency(ctx, body, body.emergency.reason);
      const requester = requirePerson(ctx.actor);
      const environment = await loadEnvironment(sql, { key: body.environment });
      await requireDeployer(ctx, sql, environment, requester);
      const now = deps.now();
      const prepared = await prepare(sql, environment, body, requester, body.send, now);
      const at = now.toISOString();
      const id = await sql.begin(async (tx) => {
        const status = body.send ? 'waiting' : 'draft';
        const request = await insertRequest(tx, environment, body, requester, status, at);
        await writeChildren(tx, request.id, prepared, body.send, at);
        const named = { ...request, title: body.title };
        if (body.send) await announceSent(deps, ctx, tx, named, prepared, requester, now);
        else await recordActivity(tx, request.id, requester, 'created', {}, now);
        return request.id;
      });
      return detail(ctx, id);
    },

    async update(ctx: RequestContext, number: string, body: UpdateChangeRequestBody) {
      const person = requirePerson(ctx.actor);
      const request = await loadRequest(sql, { number });
      if (request.requested_by !== person) {
        await authorizePipelines(ctx, 'pipelines.platform.admin');
      }
      requireEditable(request.status);
      const environment = await loadEnvironment(sql, { id: request.environment_id });
      const current = await loadItems(sql, request.id);
      const draft: Draft = {
        title: body.title ?? request.title,
        why: body.why ?? request.why,
        risk: body.risk ?? request.risk,
        when:
          body.when ??
          (request.deploy_at ? { kind: 'at', at: request.deploy_at } : { kind: 'asap' }),
        rollback: body.rollback ?? request.rollback,
        items:
          body.items ??
          current.map((item) => ({
            application: item.application_key,
            releaseId: item.release_id,
          })),
        picks: body.picks ?? (await storedPicks(sql, request.id)),
      };
      const now = deps.now();
      const prepared = await prepare(sql, environment, draft, person, false, now);
      const at = now.toISOString();
      await sql.begin(async (tx) => {
        await tx`
          update pipeline_change_requests set title = ${draft.title}, why = ${draft.why},
            risk = ${draft.risk},
            deploy_at = ${draft.when.kind === 'at' ? draft.when.at : null}::timestamptz,
            rollback = ${draft.rollback}, updated_at = ${at}::timestamptz
          where id = ${request.id}`;
        await writeChildren(tx, request.id, prepared, false, at);
        await recordActivity(tx, request.id, person, 'edited', {}, now);
      });
      return detail(ctx, request.id);
    },

    async send(ctx: RequestContext, number: string) {
      const person = requirePerson(ctx.actor);
      const request = await loadRequest(sql, { number });
      if (request.requested_by !== person) {
        await authorizePipelines(ctx, 'pipelines.platform.admin');
      }
      requireEditable(request.status);
      const environment = await loadEnvironment(sql, { id: request.environment_id });
      await requireDeployer(ctx, sql, environment, person);
      const draft: Draft = {
        title: request.title,
        why: request.why,
        risk: request.risk,
        when: request.deploy_at ? { kind: 'at', at: request.deploy_at } : { kind: 'asap' },
        rollback: request.rollback,
        items: (await loadItems(sql, request.id)).map((item) => ({
          application: item.application_key,
          releaseId: item.release_id,
        })),
        picks: await storedPicks(sql, request.id),
      };
      const now = deps.now();
      const requester = request.requested_by ?? person;
      const prepared = await prepare(sql, environment, draft, requester, true, now);
      const at = now.toISOString();
      await sql.begin(async (tx) => {
        const locked = await loadRequest(tx, { id: request.id }, true);
        requireEditable(locked.status);
        await tx`update pipeline_change_requests set status = 'waiting',
          sent_at = ${at}::timestamptz, decided_at = null, updated_at = ${at}::timestamptz
          where id = ${request.id}`;
        await writeChildren(tx, request.id, prepared, true, at);
        await announceSent(deps, ctx, tx, locked, prepared, requester, now);
      });
      return detail(ctx, request.id);
    },

    async approve(ctx: RequestContext, number: string, note: string | null) {
      const { id, approved } = await approve(deps, ctx, number, note);
      if (approved) await deployIfApproved(id);
      return detail(ctx, id);
    },

    async reject(
      ctx: RequestContext,
      number: string,
      body: { kind: 'reject' | 'changes_requested'; note: string },
    ) {
      return detail(ctx, await reject(deps, ctx, number, body.kind, body.note));
    },

    async withdraw(ctx: RequestContext, number: string, reason: string | null) {
      return detail(ctx, await withdraw(deps, ctx, number, reason));
    },

    /** The minute sweep: deploys whose time or window came, and requests that finished. */
    sweep: (limit?: number) => sweepApproved(deps, limit),
  };
}

export type ChangeRequestsService = ReturnType<typeof createChangeRequestsService>;
