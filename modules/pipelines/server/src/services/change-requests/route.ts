import type { SqlExecutor } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type { ChangeRisk } from '../../../../shared/change-requests.ts';
import type { ChangeEnvironmentRow } from '../../models/change-requests.ts';
import { groupMembers, groupNames } from './rows.ts';

/*
 * The approval route of a request: the environment's rule steps, in order, each kept or
 * skipped by its condition at the request's risk, and the people the requester picked for
 * each. A pick must be a member of the step's group, never the requester, and a step needs
 * at least as many picks as approvals.
 */

export interface RouteStep {
  /** The step's place in the environment's rule. */
  position: number;
  groupId: string;
  groupName: string;
  count: number;
  when: 'always' | 'high_risk';
  applies: boolean;
}

export function stepApplies(when: string, risk: ChangeRisk): boolean {
  return when === 'always' || risk === 'high';
}

export async function routeOf(
  sql: SqlExecutor,
  environment: ChangeEnvironmentRow,
  risk: ChangeRisk,
): Promise<RouteStep[]> {
  const steps = environment.approval_rule?.steps ?? [];
  const names = await groupNames(
    sql,
    steps.map((step) => step.group),
  );
  return steps.map((step, position) => ({
    position,
    groupId: step.group,
    // A group deleted after the rule was saved still reads, so the route says what is missing.
    groupName: names.get(step.group) ?? 'A removed group',
    count: step.count,
    when: step.when === 'high_risk' ? 'high_risk' : 'always',
    applies: stepApplies(step.when, risk),
  }));
}

export interface StepPicks {
  step: RouteStep;
  users: string[];
}

/**
 * Checks every pick and returns them per applying step. A draft may be short of people; a
 * request being sent may not.
 */
export async function checkPicks(
  sql: SqlExecutor,
  route: readonly RouteStep[],
  picks: ReadonlyArray<{ step: number; users: readonly string[] }>,
  requester: string,
  complete: boolean,
): Promise<StepPicks[]> {
  const applying = route.filter((step) => step.applies);
  for (const pick of picks) {
    if (!applying.some((step) => step.position === pick.step)) {
      throw new ValidationError(`There is no approval step ${pick.step + 1} at this risk`);
    }
  }
  const result: StepPicks[] = [];
  for (const step of applying) {
    const users = [
      ...new Set(picks.filter((p) => p.step === step.position).flatMap((p) => p.users)),
    ];
    if (users.includes(requester)) {
      throw new ValidationError('You cannot approve your own change. Pick someone else.');
    }
    const members = new Set((await groupMembers(sql, step.groupId)).map((m) => m.id));
    const outsider = users.find((user) => !members.has(user));
    if (outsider) {
      throw new ValidationError(`Pick approvers from ${step.groupName}; one of them is not in it`);
    }
    if (complete && users.length < step.count) {
      throw new ValidationError(
        `${step.groupName} needs ${step.count} ${step.count === 1 ? 'approver' : 'approvers'}; pick ${step.count - users.length} more`,
      );
    }
    result.push({ step, users });
  }
  return result;
}
