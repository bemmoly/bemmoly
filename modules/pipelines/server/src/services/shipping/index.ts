import type { RequestContext, SettingsRegistry } from '@bemmoly/core';
import { decodeCursor, toPage } from '@bemmoly/core';
import { ConflictError } from '@bemmoly/shared';
import type {
  ApprovalBody,
  CancelPromotionBody,
  CreatePromotionBody,
  FreezeOverrideBody,
  ListPromotionsQuery,
  Promotion,
  PromotionPreviewQuery,
  PromotionsPage,
} from '../../../../shared/promotions.ts';
import type {
  ListDeploymentsQuery,
  ResumeDeploymentBody,
  RollbackBody,
} from '../../../../shared/deployments.ts';
import { SHIPPING_DEFAULTS } from '../../config/shipping-settings.ts';
import type { DeploymentRow, PromotionRow } from '../../models/shipping.ts';
import { authorizePipelines, personOf, requirePerson } from '../deps.ts';
import { abortLiveDeployment, resumeDeployment, rollbackFinished } from './deployments/actions.ts';
import {
  canaryAnalysis,
  getDeployment,
  getDeploymentRow,
  listDeployments,
} from './deployments/read.ts';
import { createShippingEngine } from './engine.ts';
import type { ShippingEngineDeps } from './engine-deps.ts';
import {
  cancelPromotion,
  decideApproval,
  loadPromotion,
  overrideFreeze,
} from './promotions/decisions.ts';
import { presentPromotion } from './promotions/present.ts';
import { previewPromotion } from './promotions/preview.ts';
import { requestPromotion } from './promotions/request.ts';
import { deployActionFor } from './load.ts';
import { resolveTarget } from './targets.ts';

export type { ShippingEngineDeps, Waker } from './engine-deps.ts';
export { createShippingAccess, type ShippingAccess } from './access.ts';

/*
 * Promotions and deployments behind /api/v1/pipelines: request, approve, override a freeze,
 * cancel, roll back, decide on a paused canary, and the reads the Promote screen, the
 * approvals inbox and the deployment page are built from.
 */

type Settings = Pick<SettingsRegistry, 'get'> | undefined;

async function setting(settings: Settings, key: string, fallback: number): Promise<number> {
  try {
    const value = await settings?.get(key as never);
    return typeof value === 'number' ? value : fallback;
  } catch {
    return fallback;
  }
}

export function createShippingService(deps: ShippingEngineDeps & { settings?: Settings }) {
  const engine = createShippingEngine(deps);
  const { sql } = deps;
  const present = (row: PromotionRow, ctx: RequestContext) =>
    presentPromotion(sql, deps.access, row, personOf(ctx.actor), deps.now());

  async function rolloutSettings() {
    const s = deps.settings;
    const d = SHIPPING_DEFAULTS;
    return {
      holdMinutes: await setting(s, 'pipelines.rollout.holdMinutes', d.holdMinutes),
      watchMinutes: await setting(s, 'pipelines.rollout.watchMinutes', d.watchMinutes),
      sampleSeconds: await setting(s, 'pipelines.rollout.sampleSeconds', d.sampleSeconds),
      expiryHours: await setting(s, 'pipelines.promotions.expiryHours', d.expiryHours),
    };
  }

  async function after(id: string, ctx: RequestContext): Promise<Promotion> {
    await engine.advance('promotion', id, true);
    return present(await loadPromotion(deps, id), ctx);
  }

  return {
    engine,

    async requestPromotion(
      ctx: RequestContext,
      body: CreatePromotionBody & { mode: NonNullable<CreatePromotionBody['mode']> },
    ) {
      const { id, created } = await requestPromotion(deps, ctx, body, await rolloutSettings());
      return { promotion: await after(id, ctx), created };
    },

    async previewPromotion(ctx: RequestContext, query: PromotionPreviewQuery) {
      return previewPromotion(deps, ctx, query, await rolloutSettings());
    },

    async getPromotion(ctx: RequestContext, id: string): Promise<Promotion> {
      await authorizePipelines(ctx);
      return present(await loadPromotion(deps, id), ctx);
    },

    async listPromotions(ctx: RequestContext, query: ListPromotionsQuery): Promise<PromotionsPage> {
      await authorizePipelines(ctx);
      const after = decodeCursor(query.cursor);
      const [domain, group] = (query.scope ?? '').split('/');
      const open = ['requested', 'gating', 'awaiting_approval', 'scheduled'];
      const rows = await sql<PromotionRow[]>`
        select p.* from pipeline_promotions p
        join pipeline_applications a on a.id = p.application_id
        join pipeline_domains d on d.id = a.domain_id
        join pipeline_groups g on g.id = a.group_id
        where true
          ${domain ? sql`and d.key = ${domain}` : sql``}
          ${group ? sql`and g.key = ${group}` : sql``}
          ${query.application ? sql`and a.key = ${query.application}` : sql``}
          ${query.state ? sql`and p.state = ${query.state}` : sql``}
          ${query.awaitingMe ? sql`and p.state = any(${open}::text[])` : sql``}
          ${after ? sql`and p.id < ${after}::uuid` : sql``}
        order by p.id desc limit ${query.awaitingMe ? 200 : query.limit + 1}`;
      let items = await Promise.all(rows.map((row) => present(row, ctx)));
      if (query.awaitingMe) {
        items = items
          .filter((item) => item.requirements.some((r) => r.canApprove))
          .slice(0, query.limit + 1);
      }
      const page = toPage(items, query.limit);
      return { items: page.rows, nextCursor: page.nextCursor };
    },

    async decide(ctx: RequestContext, id: string, body: ApprovalBody) {
      const row = await loadPromotion(deps, id);
      const validHours = await setting(
        deps.settings,
        'pipelines.approvals.validHours',
        SHIPPING_DEFAULTS.validHours,
      );
      await decideApproval(deps, ctx, row, body, validHours);
      return after(id, ctx);
    },

    async overrideFreeze(ctx: RequestContext, id: string, body: FreezeOverrideBody) {
      await overrideFreeze(deps, ctx, await loadPromotion(deps, id), body);
      return after(id, ctx);
    },

    async cancel(ctx: RequestContext, id: string, body: CancelPromotionBody) {
      await cancelPromotion(deps, ctx, await loadPromotion(deps, id), body);
      return present(await loadPromotion(deps, id), ctx);
    },

    async listDeployments(ctx: RequestContext, query: ListDeploymentsQuery) {
      await authorizePipelines(ctx);
      return listDeployments(sql, query);
    },

    async getDeployment(ctx: RequestContext, id: string) {
      await authorizePipelines(ctx);
      return getDeployment(sql, id);
    },

    async canary(ctx: RequestContext, id: string) {
      await authorizePipelines(ctx);
      const row = await getDeploymentRow(sql, id);
      // No connection means no metrics source: the screen then says the checks are waiting.
      const hasMetrics = await resolveTarget(
        sql,
        deps.providers,
        row.application_id,
        row.environment_id,
      ).then(
        (resolved) => Boolean(resolved.provider.metrics),
        () => false,
      );
      return canaryAnalysis(sql, id, hasMetrics);
    },

    /** One action from anywhere: a live deployment goes back now, a finished one is replaced. */
    async rollback(ctx: RequestContext, id: string, body: RollbackBody) {
      const person = requirePerson(ctx.actor);
      const [row] = await sql<DeploymentRow[]>`select * from pipeline_deployments where id = ${id}`;
      if (!row) return getDeployment(sql, id);
      await deps.access.authorize(ctx, 'rollback', {
        applicationId: row.application_id,
        environmentId: row.environment_id,
      });
      const reason = body.reason?.trim() || 'Rolled back by hand';
      if (['pending', 'deploying', 'canary', 'waiting'].includes(row.state)) {
        if (!(await abortLiveDeployment(deps, id, reason))) {
          throw new ConflictError('The deployment is busy; try again in a moment');
        }
        if (row.promotion_id) await engine.advance('promotion', row.promotion_id, true);
        return getDeployment(sql, id);
      }
      const created = await rollbackFinished(deps, row, {
        toRelease: body.toRelease ?? null,
        reason,
        by: person,
      });
      return getDeployment(sql, created);
    },

    async resume(ctx: RequestContext, id: string, body: ResumeDeploymentBody) {
      const [row] = await sql<DeploymentRow[]>`select * from pipeline_deployments where id = ${id}`;
      if (!row) return getDeployment(sql, id);
      const action =
        body.decision === 'rollback' ? 'rollback' : await deployActionFor(sql, row.environment_id);
      await deps.access.authorize(ctx, action, {
        applicationId: row.application_id,
        environmentId: row.environment_id,
      });
      const reason =
        body.reason?.trim() ||
        (body.decision === 'continue' ? 'Continued by hand' : 'Rolled back by hand');
      await resumeDeployment(deps, row, body.decision, reason);
      if (body.decision === 'rollback' && row.promotion_id) {
        await engine.advance('promotion', row.promotion_id, true);
      }
      return getDeployment(sql, id);
    },
  };
}

export type ShippingService = ReturnType<typeof createShippingService>;
