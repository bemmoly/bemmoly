import type { Approvals } from '../contracts/approvals.ts';
import { ModuleLoadError } from './errors.ts';

/**
 * A module's view of the approval engine: it starts requests only on its own workflows and
 * reads only its own subjects. Bound late, as the engine is wired after modules register.
 */
export function createModuleApprovals(
  moduleId: string,
  engine: () => Approvals | undefined,
): Approvals {
  const bound = (): Approvals => {
    const approvals = engine();
    if (!approvals) {
      throw new ModuleLoadError(
        `Module "${moduleId}": approvals are not available in this process`,
        moduleId,
      );
    }
    return approvals;
  };
  const own = (id: string, what: string) => {
    if (id !== moduleId) {
      throw new ModuleLoadError(`Module "${moduleId}" may not ${what} for "${id}"`, moduleId);
    }
  };
  return {
    start(actor, input) {
      own(input.moduleId, 'start approval requests');
      return bound().start(actor, input);
    },
    decide: (actor, id, body) => bound().decide(actor, id, body),
    withdraw: (actor, id, body) => bound().withdraw(actor, id, body),
    get: (actor, id) => bound().get(actor, id),
    list: (actor, query) => bound().list(actor, query),
    forSubject(id, subject) {
      own(id, 'read approval requests');
      return bound().forSubject(id, subject);
    },
    ensureWorkflow(input) {
      own(input.moduleId, 'define approval workflows');
      return bound().ensureWorkflow(input);
    },
    delegation: (actor) => bound().delegation(actor),
    setDelegation: (actor, body) => bound().setDelegation(actor, body),
    clearDelegation: (actor) => bound().clearDelegation(actor),
  };
}
