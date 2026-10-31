import type { RequestContext, SqlClient } from '@bemmoly/core';
import type {
  ApplyCopyBody,
  CopyPlan,
  CopyPlanQuery,
  CopyResult,
  CopySecretMode,
} from '../../../../shared/config-copy.ts';
import {
  authorizePipelines,
  personOf,
  requireAccess,
  requireDatabase,
  type PipelinesServiceDeps,
} from '../deps.ts';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { applyApplication } from './apply.ts';
import { planApplication, secretModeFor } from './plan.ts';
import { loadCopyApplications, loadCopyEnvironment, type CopyEnvironment } from './read.ts';

/*
 * Copying configuration between environments (shared/config-copy.ts). The plan needs only to
 * see both environments. Applying needs `manage` on each application in the target, and
 * `deploy` there too when the target is protected, as setting its deploy settings would.
 * Every apply is worked out again from what is stored now, so ticking an item that a copy in
 * between already made does nothing: copying twice changes nothing the second time.
 */

export function createConfigCopyService(
  deps: PipelinesServiceDeps & { providers: ProviderSourceOrRegistry },
) {
  const sql = (): SqlClient => requireDatabase(deps);

  async function plan(from: CopyEnvironment, to: CopyEnvironment, keys?: readonly string[]) {
    const applications = await loadCopyApplications(sql(), from, to, keys);
    const planned = applications.map((app) => ({ app, plan: planApplication(app, to) }));
    const view: CopyPlan = {
      from: { id: from.id, key: from.key, name: from.name, class: from.class },
      to: { id: to.id, key: to.key, name: to.name, class: to.class },
      applications: planned
        .map(({ plan: one }) => one)
        .filter((one) => keys !== undefined || one.items.length > 0),
      secretMode: secretModeFor(to),
    };
    return { planned, view };
  }

  async function environments(ctx: RequestContext, fromKey: string, toKey: string) {
    await authorizePipelines(ctx);
    const from = await loadCopyEnvironment(sql(), fromKey);
    const to = await loadCopyEnvironment(sql(), toKey);
    const access = requireAccess(deps);
    await access.authorizeAction(ctx, 'view', { environment: from.id });
    await access.authorizeAction(ctx, 'view', { environment: to.id });
    return { from, to };
  }

  return {
    async plan(ctx: RequestContext, toKey: string, query: CopyPlanQuery): Promise<CopyPlan> {
      const { from, to } = await environments(ctx, query.from, toKey);
      return (await plan(from, to, query.applications)).view;
    },

    async apply(ctx: RequestContext, toKey: string, body: ApplyCopyBody): Promise<CopyResult> {
      const { from, to } = await environments(ctx, body.from, toKey);
      const keys = [...new Set(body.items.map((item) => item.id.split(':')[0] ?? ''))];
      const { planned } = await plan(from, to, keys);
      const ticked = new Map<string, CopySecretMode | undefined>(
        body.items.map((item) => [item.id, item.secret]),
      );
      const access = requireAccess(deps);
      const touched = planned.filter(({ plan: one }) => one.items.some((i) => ticked.has(i.id)));
      for (const { app } of touched) {
        const target = { application: app.id, environment: to.id };
        await access.authorizeAction(ctx, 'manage', target, { record: true });
        if (to.protected) await access.authorizeAction(ctx, 'deploy', target, { record: true });
      }
      let applied = 0;
      for (const { app, plan: one } of touched) {
        applied += await applyApplication(sql(), deps.providers, {
          app,
          plan: one,
          from,
          to,
          ticked,
          by: personOf(ctx.actor),
        });
      }
      return { applied, plan: (await plan(from, to, keys)).view };
    },
  };
}

export type ConfigCopyService = ReturnType<typeof createConfigCopyService>;
