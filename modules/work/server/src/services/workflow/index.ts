import type { RequestContext } from '@bemmoly/core';
import type { AvailableTransition, WorkflowRuleDefinition } from '../../../../shared/index.ts';
import type { WorkflowServiceDeps } from './deps.ts';
import { loadIssueByKey } from './issue-access.ts';
import { createWorkflowPublisher } from './publish.ts';
import { ruleCatalog } from './rules/index.ts';
import { createTransitionGate } from './transition.ts';
import { validateDraft } from './validate.ts';
import { createWorkflowReads, requireDatabase } from './workflows.ts';

/**
 * Workflows as the editor and the issue page use them, plus the gate the
 * issues service calls. The pieces live in their own files; this is the one
 * surface the controller and the other services see.
 */
export function createWorkflowService(deps: WorkflowServiceDeps) {
  const reads = createWorkflowReads(deps);
  const publisher = createWorkflowPublisher(deps);
  const gate = createTransitionGate(deps);

  return {
    ...reads,
    ...publisher,
    gate,
    async validate(ctx: RequestContext, id: string) {
      return validateDraft(await reads.getDraft(ctx, id));
    },
    /** What the issue page may offer, read from the row by key so no issues code is needed. */
    async issueTransitions(ctx: RequestContext, key: string): Promise<AvailableTransition[]> {
      const issue = await loadIssueByKey(requireDatabase(deps), key);
      return gate.canTransition(ctx, issue);
    },
    async rules(ctx: RequestContext): Promise<WorkflowRuleDefinition[]> {
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', { kind: 'module', moduleId: 'work' });
      return ruleCatalog({
        ...(deps.lql ? { lql: deps.lql } : {}),
        ...(deps.jobs ? { jobs: deps.jobs } : {}),
      });
    },
  };
}

export type WorkflowService = ReturnType<typeof createWorkflowService>;
export type { TransitionGate, TransitionResult, WorkflowIssue } from './contract.ts';
export type { IssueReads, IssueWrites, LqlEvaluator, WorkflowServiceDeps } from './deps.ts';
export { moveIssuesStatus } from './issue-access.ts';
export { validateDraft } from './validate.ts';
