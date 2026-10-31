import type { RequestContext } from '@bemmoly/core';
import {
  can,
  LEAVE_CAPABILITY,
  requireDirectory,
  userIdOf,
  type PeopleServiceDeps,
} from '../common.ts';

/**
 * Who sees the details of someone's leave (its kind, note and balance): the person, anyone
 * above them in the reporting line, and people who manage leave. Everyone else sees only
 * that they are away.
 */
export function createLeaveVisibility(deps: PeopleServiceDeps) {
  return {
    async mayManageAll(ctx: RequestContext): Promise<boolean> {
      return can(ctx, LEAVE_CAPABILITY);
    },

    /** The people whose details the viewer sees: null for everyone. */
    async visibleUsers(ctx: RequestContext): Promise<Set<string> | null> {
      if (await can(ctx, LEAVE_CAPABILITY)) return null;
      const me = userIdOf(ctx);
      if (!me) return new Set();
      const below = await requireDirectory(deps).reports(me, { all: true });
      return new Set([me, ...below.map((person) => person.userId)]);
    },
  };
}

export type LeaveVisibility = ReturnType<typeof createLeaveVisibility>;
