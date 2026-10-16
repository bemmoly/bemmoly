import type {
  Approval,
  ApprovalRequirement,
  ApplicationRef,
  EnvironmentRef,
  GateResult,
  JoinableDeparture,
  Promotion,
  PromotionPreview,
  PromotionRelease,
  RolloutPlan,
} from '@bemmoly/module-pipelines/shared';
import { useEffect } from 'react';
import { useSearchText } from '../../hooks/use-search-state.ts';
import { usePreview, usePromotion } from '../../hooks/use-shipping.ts';

/**
 * What the Promote screen draws, the same whether the promotion is only previewed or already
 * requested: the person asking sees exactly what the approver will see.
 */
export interface PromoteView {
  release: PromotionRelease;
  previous: { id: string; version: string } | null;
  application: ApplicationRef;
  environments: readonly EnvironmentRef[];
  gates: readonly GateResult[];
  requirements: readonly ApprovalRequirement[];
  approvals: readonly Approval[];
  plan: RolloutPlan;
  policies: readonly { id: string; name: string }[];
  departures: readonly JoinableDeparture[];
  expiresAt: string | null;
  promotion: Promotion | null;
  preview: PromotionPreview | null;
}

function fromPreview(preview: PromotionPreview): PromoteView {
  return { ...preview, approvals: [], promotion: null, preview };
}

function fromPromotion(promotion: Promotion): PromoteView {
  const environments = promotion.plan.waves.flatMap((wave) => wave.environments);
  return {
    release: promotion.release,
    previous: promotion.previous,
    application: promotion.application,
    environments: environments.length ? environments : [promotion.environment],
    gates: promotion.gates,
    requirements: promotion.requirements,
    approvals: promotion.approvals,
    plan: promotion.plan,
    policies: promotion.policies,
    departures: promotion.departure
      ? [
          {
            id: promotion.departure.id,
            trainName: promotion.departure.trainName,
            departsAt: promotion.departure.departsAt,
            applicationCount: 0,
          },
        ]
      : [],
    expiresAt: promotion.expiresAt,
    promotion,
    preview: null,
  };
}

/**
 * ?promotion= opens a requested promotion; otherwise the release and ?to= are previewed, and a
 * promotion of the same release to the same place that is still open replaces the preview.
 */
export function usePromote(releaseId: string) {
  const [promotionId, setPromotionId] = useSearchText('promotion');
  const [to] = useSearchText('to');
  const promotion = usePromotion(promotionId || null);
  const preview = usePreview(promotionId ? null : { release: releaseId, to: to || 'prod' });
  const existing = preview.data?.existingId ?? null;
  useEffect(() => {
    if (existing) setPromotionId(existing);
  }, [existing, setPromotionId]);
  const query = promotionId ? promotion : preview;
  const view = promotion.data
    ? fromPromotion(promotion.data)
    : preview.data && !existing
      ? fromPreview(preview.data)
      : null;
  return { view, query, to: to || 'prod', open: setPromotionId };
}
