import { useDocumentTitle, useT } from '@bemmoly/core-web';
import type { Layout, Provider } from '@bemmoly/module-pipelines/shared';
import { Button } from '@bemmoly/ui';
import { useState } from 'react';
import {
  useArrivalCheck,
  useCloudWrites,
  useConnections,
  useLandingZonePlan,
} from '../../../hooks/use-clouds.ts';
import { useGo } from '../../../hooks/use-go.ts';
import { useSearchState, useSearchText } from '../../../hooks/use-search-state.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { refusalOf } from '../../../parts/load-failed.tsx';
import { ApplyProgress } from './apply-progress.tsx';
import { ConnectAttached } from './connect-attached.tsx';
import { ConnectForm } from './connect-form.tsx';
import { ConnectManaged } from './connect-managed.tsx';
import { unitOf } from './connection-card.tsx';
import { GrantCheck } from './grant-check.tsx';
import { LayoutChooser } from './layout-chooser.tsx';
import { MODES, ModeChoice } from './mode-choice.tsx';
import { PlanPanel } from './plan-panel.tsx';
import { ProviderCards } from './provider-cards.tsx';

/**
 * Connect a cloud. Google Cloud's "Create projects for me" takes what bootstrap.sh printed,
 * checks the folder grant on arrival (?connection=), then offers Starter, Standard or
 * Enterprise beside the plan of every project, registry and identity it would make. Create
 * applies that plan and the page follows it (?plan=) until it is done or stops, with Retry.
 * "Use projects I already have" (?mode=attached) creates nothing and goes to the card.
 */
export default function ConnectCloud() {
  const t = useT(pipelinesText);
  useDocumentTitle([t('pipelines.clouds.connect'), t('pipelines.platform.title'), 'Pipelines']);
  const go = useGo();
  const [connectionId, setConnection] = useSearchText('connection');
  const [planId, setPlan] = useSearchText('plan');
  const connection = useConnections().data?.items.find((item) => item.id === connectionId) ?? null;
  const arrival = useArrivalCheck();
  const [picked, setPicked] = useState<Provider | null>(null);
  const [mode, setMode] = useSearchState('mode', MODES, 'managed');
  const provider = connection?.provider ?? picked ?? 'gcp';
  const attached = connection?.mode === 'attached';
  const unit = unitOf(provider);
  const [chosen, setLayout] = useState<Layout | null>(null);
  const layout = chosen ?? connection?.layout ?? 'starter';
  const showPlan = Boolean(connection && !attached && !planId);
  const plan = useLandingZonePlan(showPlan ? connectionId : null, { layout });
  const { apply, check } = useCloudWrites();
  const checking = arrival.checking || check.isPending;
  const blocked = (plan.data?.blockers.length ?? 0) > 0;
  const adding = plan.data?.billing?.adding ?? plan.data?.counts.accounts ?? 0;
  const create = () =>
    plan.data &&
    apply.mutate(
      { id: connectionId, body: { planId: plan.data.planId, specHash: plan.data.specHash } },
      { onSuccess: () => plan.data && setPlan(plan.data.planId) },
    );
  return (
    <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 md:px-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-24 leading-title font-semibold text-tx">
          {t('pipelines.clouds.connect')}
        </h2>
        <p className="text-13 text-tx-2">{t('pipelines.clouds.connectIntro')}</p>
      </div>
      <ProviderCards
        value={provider}
        onChange={(info) => !connectionId && setPicked(info.provider)}
      />
      {!connectionId && provider === 'gcp' && <ModeChoice value={mode} onChange={setMode} />}
      {!connectionId ? (
        provider !== 'gcp' ? (
          <ConnectForm key={provider} onConnected={setConnection} />
        ) : mode === 'attached' ? (
          <ConnectAttached
            onConnected={(id) => go({ to: '/platform/clouds', search: { connection: id } })}
          />
        ) : (
          <ConnectManaged onConnected={setConnection} />
        )
      ) : attached && connection ? (
        <p className="rounded-card border border-line bg-card p-4 text-13 text-tx-2 shadow-e1">
          {t('pipelines.clouds.attachedNoZone', { name: connection.name })}
        </p>
      ) : planId ? (
        <ApplyProgress connection={connectionId} plan={planId} />
      ) : (
        <>
          {connection?.provider === 'gcp' && (
            <GrantCheck
              connection={connection}
              checking={checking}
              onCheck={() => check.mutate(connection.id)}
            />
          )}
          <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
            <LayoutChooser value={layout} unit={unit} onChange={setLayout} />
            <PlanPanel
              plan={plan.data}
              unit={unit}
              error={plan.isError ? plan.error : null}
              onRetry={() => void plan.refetch()}
            />
          </div>
        </>
      )}
      {connectionId && (
        <div className="flex flex-col gap-3 border-t border-line pt-3.5 md:flex-row md:items-center">
          <p className="min-w-0 flex-1 truncate text-12 text-tx-2">
            {apply.error && (
              <span className="text-red-tx">
                {refusalOf(apply.error)?.sentence ?? t('pipelines.clouds.applyFailed')}
              </span>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => go({ to: '/platform/clouds' })}>
              {planId ? t('pipelines.capacity.done') : t('pipelines.clouds.back')}
            </Button>
            {!planId && !attached && (
              <Button
                variant="primary"
                disabled={!plan.data || blocked || checking}
                loading={apply.isPending}
                onClick={create}
              >
                {adding > 0
                  ? t('pipelines.clouds.create', { unit, count: adding })
                  : t('pipelines.clouds.applyChanges')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
