import type { SqlExecutor } from '@bemmoly/core';
import type { ApprovalRequirement } from '../../../../../shared/promotions.ts';
import type { ApprovalRule, ShippingAccess, ShippingTarget } from '../access.ts';

/*
 * How far each approval rule has got. An approval counts only when a person gave it, for
 * this release's digest, before it expired, and (when the rule says so) the person is not
 * an author of the release or the one who asked for the promotion.
 */

export interface ApprovalStateInput {
  promotionId: string;
  target: ShippingTarget;
  rules: readonly ApprovalRule[];
  releaseDigest: string;
  /** People who may never approve toward a rule that excludes authors. */
  authors: readonly string[];
  viewerId: string | null;
  now: Date;
}

export interface ApprovalState {
  requirements: ApprovalRequirement[];
  satisfied: boolean;
  rejection: { userId: string; name: string; comment: string | null } | null;
}

interface CountedRow {
  user_id: string;
  name: string;
  requirement: string;
  decision: string;
  release_digest: string;
  comment: string | null;
  expires_at: string | null;
}

export async function approvalState(
  sql: SqlExecutor,
  access: ShippingAccess,
  input: ApprovalStateInput,
): Promise<ApprovalState> {
  const rows = await sql<CountedRow[]>`
    select a.user_id, u.name, a.requirement, a.decision, a.release_digest, a.comment, a.expires_at
    from pipeline_approvals a join users u on u.id = a.user_id
    where a.promotion_id = ${input.promotionId}
    order by a.created_at`;
  const live = rows.filter(
    (row) =>
      row.release_digest === input.releaseDigest &&
      (!row.expires_at || new Date(row.expires_at).getTime() > input.now.getTime()),
  );
  const rejected = live.find((row) => row.decision === 'rejected');
  const requirements: ApprovalRequirement[] = [];
  for (const rule of input.rules) {
    const candidates = await access.candidates(sql, rule, input.target);
    const excluded = new Set(rule.excludeAuthors ? input.authors : []);
    const have = live.filter(
      (row) =>
        row.decision === 'approved' &&
        row.requirement === rule.requirement &&
        !excluded.has(row.user_id),
    );
    const given = new Set(rows.map((row) => row.user_id));
    requirements.push({
      requirement: rule.requirement,
      label: rule.excludeAuthors ? `${rule.label}, not the author` : rule.label,
      needed: rule.count,
      have: Math.min(have.length, rule.count),
      candidates: candidates.filter((person) => !excluded.has(person.id)),
      excludesAuthors: rule.excludeAuthors,
      canApprove:
        input.viewerId !== null &&
        have.length < rule.count &&
        !excluded.has(input.viewerId) &&
        !given.has(input.viewerId) &&
        candidates.some((person) => person.id === input.viewerId),
    });
  }
  return {
    requirements,
    satisfied: !rejected && requirements.every((r) => r.have >= r.needed),
    rejection: rejected
      ? { userId: rejected.user_id, name: rejected.name, comment: rejected.comment }
      : null,
  };
}

/** The rule a person's approval counts toward: the first unmet one they may approve. */
export function ruleFor(requirements: readonly ApprovalRequirement[]): string | null {
  return requirements.find((requirement) => requirement.canApprove)?.requirement ?? null;
}
