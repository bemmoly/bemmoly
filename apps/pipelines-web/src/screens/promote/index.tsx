import { useT } from '@bemmoly/core-web';
import { topicOf } from '@bemmoly/module-pipelines/shared';
import { RunGlyph, SkeletonCard } from '@bemmoly/ui';
import { useParams, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useShippingStream } from '../../hooks/use-shipping.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { LoadFailed } from '../../parts/load-failed.tsx';
import { PROMOTION_GLYPH } from '../../parts/promotion-state.ts';
import { Screen } from '../../parts/screen.tsx';
import { TierChip } from '../../parts/tier-chip.tsx';
import { ChangesCard } from './changes-card.tsx';
import { DecisionBar } from './decision-bar.tsx';
import { GatesCard } from './gates-card.tsx';
import { RolloutCard, type RolloutChoice } from './rollout-card.tsx';
import { usePromote } from './use-promote.ts';

const CLASSES = ['dev', 'staging', 'prod'] as const;

/**
 * Promote: the decision screen. What is changing, whether every gate is met, who still has to
 * approve and how it will roll across regions, the same for the person asking and the person
 * approving. Mod+Enter requests; A approves.
 */
export default function PromoteScreen() {
  const t = useT(pipelinesText);
  const router = useRouter();
  const { releaseId = '' } = useParams({ strict: false }) as { releaseId?: string };
  const { view, query, to, open } = usePromote(releaseId);
  // The roll back switch starts where the plan does until the person changes it.
  const [picked, setPicked] = useState<{ departure: string; autoRollback: boolean | null }>({
    departure: '',
    autoRollback: null,
  });
  const choice: RolloutChoice = {
    departure: picked.departure,
    autoRollback: picked.autoRollback ?? view?.plan.autoRollback ?? true,
  };
  useShippingStream(view ? [topicOf.application(view.application.key)] : []);
  const target = (CLASSES as readonly string[]).includes(to)
    ? t(`pipelines.envClass.${to as (typeof CLASSES)[number]}`)
    : (view?.environments.find((environment) => environment.key === to)?.name ?? to);
  const title = view
    ? t('pipelines.promote.heading', {
        application: view.application.name,
        version: view.release.version,
        target,
      })
    : t('pipelines.promote.title');
  const state = view?.promotion?.state;
  return (
    <Screen
      title={title}
      meta={
        view && (
          <span className="flex items-center gap-2">
            <TierChip tier={view.application.tier} />
            {state && (
              <span className="flex items-center gap-1.5 text-tx-2">
                <RunGlyph state={PROMOTION_GLYPH[state]} size={14} />
                {t(`pipelines.promotionState.${state}`)}
              </span>
            )}
          </span>
        )
      }
    >
      {query.isError && !view ? (
        <LoadFailed error={query.error} onRetry={() => void query.refetch()} />
      ) : !view ? (
        <div aria-busy className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-3">
            <ChangesCard view={view} />
            <GatesCard view={view} />
            <RolloutCard view={view} choice={choice} onChoice={setPicked} />
          </div>
          <DecisionBar
            view={view}
            to={to}
            choice={choice}
            onRequested={open}
            onBack={() => router.history.back()}
          />
        </>
      )}
    </Screen>
  );
}
