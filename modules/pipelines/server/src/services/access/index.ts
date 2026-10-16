import type { RequestContext } from '@bemmoly/core';
import type { AccessDecision, CheckAccessBody } from '../../../../shared/access.ts';
import {
  PIPELINES_RESOURCE,
  requireDatabase,
  requirePerson,
  type PipelinesServiceDeps,
} from '../deps.ts';
import { createBindingsService } from './bindings.ts';
import { createAccessEngine, type AccessEngine } from './engine.ts';
import { createPoliciesService } from './policies.ts';
import type { AccessTarget, Decision } from './types.ts';

/*
 * Access and policy (architecture §10). Other services reach the engine through
 * `deps.access.authorizeAction(ctx, action, target)`; the screens reach bindings, policies
 * and the checker through the controller.
 */

export type { AccessEngine, AuthorizeOptions } from './engine.ts';
export type { AccessTarget, Decision, MatchedPolicy } from './types.ts';

const toContract = (decision: Decision): AccessDecision => ({
  allowed: decision.allowed,
  sentence: decision.sentence,
  trace: decision.trace,
  askWho: decision.askWho,
  decisionId: decision.decisionId,
});

export function createAccessService(deps: PipelinesServiceDeps, engine?: AccessEngine) {
  const access = engine ?? createAccessEngine(deps);
  const sql = () => requireDatabase(deps);
  return {
    ...access,
    bindings: createBindingsService(sql, access),
    policies: createPoliciesService(sql, access),

    /**
     * The checker and "Why can't I?": the decision for a person, an action and a target,
     * never recorded. Asking about someone else needs Maintainer on the target or Audit.
     */
    async check(ctx: RequestContext, body: CheckAccessBody): Promise<AccessDecision> {
      const me = requirePerson(ctx.actor);
      const target: AccessTarget = {
        ...(body.application ? { application: body.application } : {}),
        ...(body.environment ? { environment: body.environment } : {}),
        ...(body.scope
          ? { scope: { kind: body.scope.kind, ...(body.scope.id ? { id: body.scope.id } : {}) } }
          : {}),
      };
      if (body.user && body.user !== me) {
        const auditor = await ctx.authz.can(ctx.actor, 'pipelines.audit', PIPELINES_RESOURCE);
        if (!auditor) await access.authorizeAction(ctx, 'manage', target);
      } else {
        await access.authorizeAction(ctx, 'view', {});
      }
      return toContract(await access.decideFor(ctx, body.user ?? me, body.action, target));
    },
  };
}

export type AccessService = ReturnType<typeof createAccessService>;
