import type { RequestContext, SqlClient } from '@bemmoly/core';
import { ForbiddenError, type CapabilityName } from '@bemmoly/shared';
import type { AccessAction, ForbiddenDetails } from '../../../../shared/access.ts';
import {
  authorizePipelines,
  personOf,
  PIPELINES_RESOURCE,
  requireDatabase,
  type PipelinesServiceDeps,
} from '../deps.ts';
import { createFactsCache } from './cache.ts';
import { decide } from './decide.ts';
import { atTime, loadPathFacts, loadPerson, resolveTarget, type CachedFacts } from './facts.ts';
import { PROTECTED_ACTIONS } from './roles.ts';
import type { AccessTarget, Decision, ScopeNode } from './types.ts';

/*
 * The fine-grained gate every Pipelines service calls after the product gate:
 * authorizeAction(ctx, action, target) answers with a decision and its trace, records it
 * for protected actions, and throws a ForbiddenError whose details carry the sentence, the
 * trace and who to ask. decideFor answers the same question for anyone without throwing,
 * for the checker and for "who may approve this".
 */

/** The coarse capability each action needs in Bemmoly's role grid before scopes are read. */
const PRODUCT_GATE: Record<AccessAction, CapabilityName> = {
  view: 'pipelines.view',
  run: 'pipelines.run',
  deploy: 'pipelines.deploy',
  request_prod: 'pipelines.deploy',
  approve: 'pipelines.approve',
  rollback: 'pipelines.deploy',
  change_variables: 'pipelines.deploy',
  manage: 'pipelines.deploy',
  platform: 'pipelines.view',
} as Record<AccessAction, CapabilityName>;

export interface AuthorizeOptions {
  /** Write the decision on this transaction instead of the pool. */
  sql?: SqlClient;
  /** Store the decision even for an unprotected action. */
  record?: boolean;
}

export interface AccessEngine {
  authorizeAction(
    ctx: RequestContext,
    action: AccessAction,
    target?: AccessTarget,
    options?: AuthorizeOptions,
  ): Promise<Decision>;
  decideFor(
    ctx: RequestContext,
    userId: string,
    action: AccessAction,
    target?: AccessTarget,
  ): Promise<Decision>;
  organisation(): Promise<ScopeNode>;
}

const targetKey = (target: AccessTarget) =>
  [
    target.application ?? '',
    target.environment ?? '',
    target.scope?.kind ?? '',
    target.scope?.id ?? '',
  ].join('|');

export function createAccessEngine(deps: PipelinesServiceDeps): AccessEngine {
  const cache = createFactsCache(() => requireDatabase(deps));

  /** The organisation is the workspace; its name is the kernel's stored value. */
  async function organisation(): Promise<ScopeNode> {
    const sql = requireDatabase(deps);
    const [row] = await sql<{ name: string | null }[]>`
      select value #>> '{}' as name from settings
      where key = 'workspace.name' and not is_secret limit 1`;
    return { kind: 'organisation', id: null, key: '', name: row?.name || 'Bemmoly' };
  }

  async function factsFor(ctx: RequestContext, userId: string, target: AccessTarget) {
    const sql = requireDatabase(deps);
    const stamp = await cache.stamp();
    const key = `${userId}#${targetKey(target)}`;
    let cached = cache.get(key, stamp);
    if (!cached) {
      const root = await organisation();
      const [resolved, person, orgAdmin] = await Promise.all([
        resolveTarget(sql, target, root),
        loadPerson(sql, userId),
        ctx.authz.can({ kind: 'user', id: userId }, 'pipelines.platform.admin', PIPELINES_RESOURCE),
      ]);
      const path = await loadPathFacts(sql, resolved.path);
      cached = { ...resolved, ...path, person: { ...person, orgAdmin } } satisfies CachedFacts;
      cache.set(key, stamp, cached);
    }
    return atTime(cached, new Date());
  }

  async function decideFor(
    ctx: RequestContext,
    userId: string,
    action: AccessAction,
    target: AccessTarget = {},
  ): Promise<Decision> {
    return decide(await factsFor(ctx, userId, target), action);
  }

  async function record(
    ctx: RequestContext,
    decision: Decision,
    facts: { application: string | null; environment: string | null },
    target: AccessTarget,
    sql: SqlClient,
  ): Promise<string> {
    const person = personOf(ctx.actor);
    const [row] = await sql<{ id: string }[]>`
      insert into pipeline_decisions
        (actor_kind, actor_id, user_id, action, application_id, environment_id, resource,
         allowed, trace)
      values (${ctx.actor.kind}, ${ctx.actor.id}, ${person}::uuid, ${decision.action},
        ${facts.application}::uuid, ${facts.environment}::uuid,
        ${JSON.stringify(target)}::jsonb, ${decision.allowed},
        ${JSON.stringify({ sentence: decision.sentence, trace: decision.trace })}::jsonb)
      returning id`;
    return row?.id ?? '';
  }

  return {
    organisation,
    decideFor,
    async authorizeAction(ctx, action, target = {}, options = {}) {
      await authorizePipelines(ctx, PRODUCT_GATE[action]);
      const person = personOf(ctx.actor);
      if (!person) {
        // System jobs (webhook consumers, schedulers) act for Pipelines itself; the product
        // gate above already let them in, and nothing here is theirs to explain.
        return {
          action,
          allowed: true,
          sentence: 'Allowed. A Pipelines system job.',
          trace: [
            { kind: 'fact', text: `System actor ${ctx.actor.id}`, effect: 'grant', ref: null },
          ],
          askWho: null,
          decisionId: null,
          roles: [],
          policies: [],
        };
      }
      const facts = await factsFor(ctx, person, target);
      const decision = decide(facts, action);
      if (PROTECTED_ACTIONS.has(action) || options.record) {
        decision.decisionId = await record(
          ctx,
          decision,
          {
            application: facts.application?.id ?? null,
            environment: facts.environment?.id ?? null,
          },
          target,
          options.sql ?? requireDatabase(deps),
        );
      }
      if (!decision.allowed) {
        const details: ForbiddenDetails = {
          action,
          sentence: decision.sentence,
          trace: decision.trace,
          askWho: decision.askWho,
          scopeKind: facts.path.at(-1)?.kind,
        };
        throw new ForbiddenError(decision.sentence, { details });
      }
      return decision;
    },
  };
}
