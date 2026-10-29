import type { ModuleStartSummaryInput } from '@bemmoly/shared';
import type { RequestContext } from '../services/authz/index.ts';

/**
 * A module's part of the start page: what is waiting on the person, what needs them and what
 * they touched lately. The kernel asks only modules the person may open, with their request
 * context, so the module applies its own container rules as its own endpoints do. Approvals
 * and other kernel sources will feed "needs you" through the same shape.
 */
export interface StartSourceDefinition {
  summaryForUser(ctx: RequestContext): Promise<ModuleStartSummaryInput>;
}

export interface StartRegistry {
  /** One source per module; a second call fails at boot. */
  add(source: StartSourceDefinition): void;
}
