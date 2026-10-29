import type { Approvals } from '../../contracts/approvals.ts';
import type { ApprovalDeps } from './context.ts';
import { createDefinitions, type Definitions } from './definitions.ts';
import { createDelegations } from './delegations.ts';
import { createQueries } from './queries.ts';
import { createRuntime } from './runtime.ts';

/** The module-facing engine plus the admin definitions the HTTP layer exposes. */
export interface ApprovalsService extends Approvals {
  workflows: Definitions;
}

export function createApprovalsService(deps: ApprovalDeps): ApprovalsService {
  const runtime = createRuntime(deps);
  const queries = createQueries(deps);
  const delegations = createDelegations(deps);
  return {
    start: runtime.start,
    decide: runtime.decide,
    withdraw: runtime.withdraw,
    get: queries.get,
    list: queries.list,
    forSubject: queries.forSubject,
    delegation: delegations.get,
    setDelegation: delegations.set,
    clearDelegation: delegations.clear,
    workflows: createDefinitions(deps),
  };
}
