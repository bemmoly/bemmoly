import {
  AI_BUDGET_PAUSED_ROLES,
  AI_ROLES,
  type AiBudgetStatus,
  type AiRole,
} from '@bemmoly/shared';
import type { AiPolicy } from '../../contracts/ai.ts';
import type { Actor } from '../../contracts/authz.ts';
import type { SettingsService } from '../../contracts/settings.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { actorUserId } from './runtime/middleware/usage.ts';
import type { AiPolicySource } from './runtime/dependencies.ts';
import { listOptOuts } from './store/preferences.ts';
import { listRoles } from './store/roles.ts';
import { monthRange, spentInMonth } from './store/runs.ts';

/** At 80% of the budget admins are warned; at 100% standard and strong pause. */
export const BUDGET_WARNING_RATIO = 0.8;

export function budgetStatusOf(
  spentUsd: number,
  budgetUsd: number | null,
  month: string,
): AiBudgetStatus {
  if (budgetUsd === null) {
    return { month, spentUsd, budgetUsd, ratio: null, state: 'unlimited', pausedRoles: [] };
  }
  const ratio = budgetUsd === 0 ? (spentUsd > 0 ? Infinity : 1) : spentUsd / budgetUsd;
  const state = ratio >= 1 ? 'paused' : ratio >= BUDGET_WARNING_RATIO ? 'warning' : 'ok';
  return {
    month,
    spentUsd: Math.round(spentUsd * 1e6) / 1e6,
    budgetUsd,
    ratio: Number.isFinite(ratio) ? Math.round(ratio * 1e4) / 1e4 : 1,
    state,
    pausedRoles: state === 'paused' ? [...AI_BUDGET_PAUSED_ROLES] : [],
  };
}

export interface PolicySourceDeps {
  sql: SqlExecutor;
  settings: SettingsService;
  /** Every role counts as assigned (the recorded provider for e2e). */
  allRolesAssigned?: boolean;
  /** How long the workspace part is cached; spend moves slowly enough for this. */
  ttlMs?: number;
}

export interface DbPolicySource extends AiPolicySource {
  budget(month?: string): Promise<AiBudgetStatus>;
  /** Drops the cache after a settings, role, provider or opt-out change. */
  invalidate(): void;
}

type WorkspacePolicy = Omit<AiPolicy, 'actorOptedOut'>;

export function createPolicySource(deps: PolicySourceDeps): DbPolicySource {
  const ttl = deps.ttlMs ?? 5_000;
  let cached: { at: number; value: WorkspacePolicy } | null = null;

  async function budget(month?: string): Promise<AiBudgetStatus> {
    const [spent, limit] = await Promise.all([
      spentInMonth(deps.sql, month),
      deps.settings.get('ai.monthlyBudgetUsd'),
    ]);
    return budgetStatusOf(spent, limit, monthRange(month).label);
  }

  async function load(): Promise<WorkspacePolicy> {
    const s = deps.settings;
    const [
      enabled,
      shareContent,
      redactEmails,
      redactNames,
      spaces,
      projects,
      allowActions,
      optOut,
    ] = await Promise.all([
      s.get('ai.enabled'),
      s.get('ai.shareContent'),
      s.get('ai.redactEmails'),
      s.get('ai.redactNames'),
      s.get('ai.excludedSpaceIds'),
      s.get('ai.excludedProjectIds'),
      s.get('ai.allowActions'),
      s.get('ai.perUserOptOutAllowed'),
    ]);
    const [roles, optedOut, status] = await Promise.all([
      deps.allRolesAssigned ? Promise.resolve(null) : listRoles(deps.sql),
      optOut ? listOptOuts(deps.sql) : Promise.resolve([]),
      budget(),
    ]);
    const assigned: readonly AiRole[] = roles ? roles.map((row) => row.role) : AI_ROLES;
    return {
      enabled,
      shareContent,
      redactEmails,
      redactNames,
      excludedSpaceIds: spaces,
      excludedProjectIds: projects,
      allowActions,
      perUserOptOutAllowed: optOut,
      optedOutUserIds: optedOut,
      budgetState: status.state,
      assignedRoles: assigned,
      availableRoles: assigned.filter((role) => !status.pausedRoles.includes(role)),
    };
  }

  return {
    async policy(actor: Actor | null) {
      if (!cached || Date.now() - cached.at > ttl) cached = { at: Date.now(), value: await load() };
      const userId = actorUserId(actor);
      const value = cached.value;
      return {
        ...value,
        actorOptedOut: Boolean(userId && value.optedOutUserIds.includes(userId)),
      };
    },
    budget,
    invalidate: () => {
      cached = null;
    },
  };
}

/** /me's aiEnabled: on, at least one language role assigned, and this person not opted out. */
export function aiEnabledFor(policy: AiPolicy): boolean {
  return (
    policy.enabled &&
    !policy.actorOptedOut &&
    policy.assignedRoles.some((role) => role !== 'embedding')
  );
}
