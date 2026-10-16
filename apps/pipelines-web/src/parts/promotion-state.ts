import type { Promotion, PromotionState } from '@bemmoly/module-pipelines/shared';
import type { RunGlyphState } from '@bemmoly/ui';

/** A promotion's state as the one run vocabulary draws it. */
export const PROMOTION_GLYPH: Record<PromotionState, RunGlyphState> = {
  requested: 'queued',
  gating: 'queued',
  awaiting_approval: 'waiting',
  scheduled: 'waiting',
  rolling_out: 'running',
  succeeded: 'passed',
  rolled_back: 'rolled_back',
  cancelled: 'skipped',
  failed: 'failed',
};

/** Still moving: a person may act on it, and the screen should stay live. */
export const OPEN_STATES: ReadonlySet<PromotionState> = new Set([
  'requested',
  'gating',
  'awaiting_approval',
  'scheduled',
  'rolling_out',
]);

/** Where a promotion is reviewed: the Promote screen, opened on this promotion. */
export function promotionPath(promotion: Pick<Promotion, 'id' | 'release' | 'environment'>) {
  return promotePath(promotion.release.id, {
    promotion: promotion.id,
    to: promotion.environment.key,
  });
}

/** The Promote screen for a release, as a path and search the router navigates to. */
export function promotePath(release: string, search: { to: string; promotion?: string }) {
  return { to: `/releases/${release}/promote` as string, search };
}

/** "5 of 7": gates that pass out of all of them. */
export function gatesMet(promotion: Pick<Promotion, 'gates'>) {
  return {
    met: promotion.gates.filter((gate) => gate.state === 'pass').length,
    total: promotion.gates.length,
    failing: promotion.gates.some((gate) => gate.state === 'fail'),
  };
}

/** Approvals given out of those needed, across every requirement. */
export function approvalsOf(promotion: Pick<Promotion, 'requirements'>) {
  return promotion.requirements.reduce(
    (sum, requirement) => ({
      have: sum.have + Math.min(requirement.have, requirement.needed),
      needed: sum.needed + requirement.needed,
    }),
    { have: 0, needed: 0 },
  );
}
