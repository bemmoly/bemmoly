import { useDocumentTitle, useT } from '@bemmoly/core-web';
import type { Layout, Provider } from '@bemmoly/module-pipelines/shared';
import { Button, Skeleton } from '@bemmoly/ui';
import { useState } from 'react';
import { useCloudWrites, useConnections, useLandingZonePlan } from '../../../hooks/use-clouds.ts';
import { useGo } from '../../../hooks/use-go.ts';
import { useSearchText } from '../../../hooks/use-search-state.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { LoadFailed, refusalOf } from '../../../parts/load-failed.tsx';
import { Panel } from '../../../parts/screen.tsx';
import { ApplyProgress } from './apply-progress.tsx';
import { ConnectForm } from './connect-form.tsx';
import { unitOf } from './connection-card.tsx';
import { LayoutChooser } from './layout-chooser.tsx';
import { ProviderCards } from './provider-cards.tsx';
import { ZoneTree } from './zone-tree.tsx';

/**
 * Connect a cloud: pick a provider, say where Pipelines may work, pick how environments map
 * to accounts, and read every folder and project it would create before choosing Create.
 * Onboarding and adding a cloud later are this same screen; ?connection= opens step two.
 */
export default function ConnectCloud() {
  const t = useT(pipelinesText);
  useDocumentTitle([t('pipelines.clouds.connect'), t('pipelines.platform.title'), 'Pipelines']);
  const go = useGo();
  const [connectionId, setConnection] = useSearchText('connection');
  const connection = useConnections().data?.items.find((item) => item.id === connectionId) ?? null;
  const [picked, setPicked] = useState<Provider | null>(null);
  const provider = connection?.provider ?? picked ?? 'gcp';
  const unit = unitOf(provider);
  const [chosen, setLayout] = useState<Layout | null>(null);
  const layout = chosen ?? connection?.layout ?? 'per-domain-environment';
  const plan = useLandingZonePlan(connectionId || null, { layout });
  const { apply } = useCloudWrites();
  const applied = apply.isSuccess;
  const blocked = (plan.data?.blockers.length ?? 0) > 0;
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
      {!connectionId ? (
        <ConnectForm key={provider} provider={provider} onConnected={setConnection} />
      ) : applied ? (
        <ApplyProgress connection={connectionId} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
          <LayoutChooser value={layout} unit={unit} onChange={setLayout} />
          <Panel
            title={t('pipelines.clouds.treeLabel')}
            meta={
              plan.data &&
              t('pipelines.clouds.planCounts', {
                unit,
                accounts: plan.data.counts.accounts,
                folders: plan.data.counts.folders,
              })
            }
          >
            {plan.isError ? (
              <LoadFailed bare size="sm" error={plan.error} onRetry={() => void plan.refetch()} />
            ) : !plan.data ? (
              <div aria-busy className="flex flex-col gap-2 rounded-control bg-sunken p-3">
                {[70, 55, 62, 48, 58, 40].map((width) => (
                  <Skeleton key={width} width={`${width}%`} height={10} />
                ))}
              </div>
            ) : (
              <>
                <ZoneTree root={plan.data.root} />
                {plan.data.blockers.map((blocker) => (
                  <p
                    key={blocker}
                    className="mt-2 rounded-control bg-amber-50 px-3 py-2 text-12 text-amber-tx"
                  >
                    {blocker}
                  </p>
                ))}
                <p className="mt-2 text-12 text-tx-3">{t('pipelines.clouds.planNote', { unit })}</p>
              </>
            )}
          </Panel>
        </div>
      )}
      {connectionId && (
        <div className="flex flex-col gap-3 border-t border-line pt-3.5 md:flex-row md:items-center">
          <p className="min-w-0 flex-1 truncate text-12 text-tx-2">
            {connection?.principal && t('pipelines.clouds.as', { principal: connection.principal })}
            {apply.error && (
              <span className="text-red-tx">
                {' '}
                {refusalOf(apply.error)?.sentence ?? t('pipelines.clouds.applyFailed')}
              </span>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => go({ to: '/platform/clouds' })}>
              {applied ? t('pipelines.capacity.done') : t('pipelines.clouds.back')}
            </Button>
            {!applied && (
              <Button
                variant="primary"
                disabled={!plan.data || blocked}
                loading={apply.isPending}
                onClick={() =>
                  plan.data &&
                  apply.mutate({
                    id: connectionId,
                    body: { planId: plan.data.planId, specHash: plan.data.specHash },
                  })
                }
              >
                {t('pipelines.clouds.create', { unit, count: plan.data?.counts.accounts ?? 0 })}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
