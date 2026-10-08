import type { RequestContext } from '@bemmoly/core';
import type { Issue } from '../../../../shared/issues.ts';

/**
 * What the issue service asks the workflow before it records a status
 * change. The workflow owns the answer (allowed roles, conditions,
 * validators); the issue service owns the write and the history row.
 * Post-actions run on the workflow's side after commit.
 */
export interface TransitionGate {
  canTransition(ctx: RequestContext, issue: Issue, toStatusId: string): Promise<boolean>;
}

/** Until the workflow service is wired, any status of the issue's workflow is reachable. */
export const openTransitionGate: TransitionGate = {
  canTransition: async () => true,
};
