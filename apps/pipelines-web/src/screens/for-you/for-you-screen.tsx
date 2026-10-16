import { formatNumber, useScreenActions, useT, useShortcutHelp } from '@bemmoly/core-web';
import type { Journey } from '@bemmoly/module-pipelines/shared';
import { Button, EmptyState, SegmentedControl, Skeleton, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useOverview } from '../../hooks/use-overview.ts';
import { useScreenKeys } from '../../hooks/use-screen-keys.ts';
import { useSearchState } from '../../hooks/use-search-state.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { api } from '../../lib/api.ts';
import { BASE_PATH } from '../../lib/sign-in.ts';
import { ActionError } from '../../parts/action-error.tsx';
import { ScreenFrame } from '../screen-frame.tsx';
import { JourneyCard, JourneySkeleton } from './journey-card.tsx';
import { Pulse, greetingId } from './pulse.tsx';
import { OnCallPanel, reviewPath, TeamsPanel, WaitingPanel } from './side-panels.tsx';
import { useForYou } from './use-for-you.ts';

const TABS = ['in-flight', 'shipped'] as const;

/**
 * Where an engineer lands: their changes as journeys across every environment, the approvals
 * waiting on them, their teams' broken main and their on-call. J K move between changes,
 * Enter opens one, A reviews the first approval, Shift+R re-runs a failure.
 */
export default function ForYouScreen() {
  const t = useT(pipelinesText);
  const toast = useToast();
  const router = useRouter();
  const navigate = useNavigate();
  const [tab, setTab] = useSearchState('tab', TABS, 'in-flight');
  const overview = useOverview('');
  const forYou = useForYou(tab);
  const [selected, setSelected] = useState(0);
  const journeys = forYou.data?.journeys ?? [];
  const current = journeys[Math.min(selected, Math.max(0, journeys.length - 1))];

  const open = (journey: Journey) => {
    if (journey.promotionId && journey.releaseId)
      router.history.push(
        `${BASE_PATH}/releases/${journey.releaseId}/promote?promotion=${journey.promotionId}`,
      );
    else if (journey.runId) void navigate({ to: '/runs/$id', params: { id: journey.runId } });
    else if (journey.application)
      void navigate({ to: '/applications/$key', params: { key: journey.application.key } });
  };
  const rerun = useMutation({
    mutationFn: (runId: string) => api.delivery.rerun(runId, { only: 'failed' }),
    onSuccess: (created) =>
      toast.show({
        tone: 'ok',
        title: t('pipelines.run.reranFailed', { number: formatNumber(created.number) }),
      }),
  });
  const move = (by: number) => {
    const next = Math.max(0, Math.min(journeys.length - 1, selected + by));
    setSelected(next);
    document
      .querySelectorAll<HTMLElement>('[data-journey]')
      [next]?.scrollIntoView({ block: 'nearest' });
  };
  const failing = journeys.find(
    (journey) => journey.note.action === 'rerun_failed' && journey.runId,
  );
  const firstApproval = forYou.data?.waitingForMe[0];
  useShortcutHelp({
    id: 'pipelines.forYou',
    label: t('pipelines.keys.forYou'),
    keys: [
      { keys: 'J K', label: t('pipelines.keys.moveRows') },
      { keys: 'Enter', label: t('pipelines.keys.openRow') },
      { keys: 'A', label: t('pipelines.forYou.review') },
      { keys: 'Shift+R', label: t('pipelines.run.rerunFailed') },
    ],
  });
  useScreenKeys({
    j: () => move(1),
    k: () => move(-1),
    enter: () => current && open(current),
    a: () => firstApproval && router.history.push(reviewPath(firstApproval)),
    'shift+r': () => failing?.runId && rerun.mutate(failing.runId),
  });
  useScreenActions([
    ...(firstApproval
      ? [
          {
            id: 'forYou.review',
            title: t('pipelines.forYou.reviewFirst', { title: firstApproval.title }),
            keys: 'A',
            run: () => router.history.push(reviewPath(firstApproval)),
          },
        ]
      : []),
    ...(failing?.runId
      ? [
          {
            id: 'forYou.rerun',
            title: t('pipelines.forYou.rerunMine', { title: failing.title }),
            keys: 'Shift+R',
            run: () => failing.runId && rerun.mutate(failing.runId),
          },
        ]
      : []),
  ]);

  const name = overview.data?.me.firstName ?? '';
  return (
    <ScreenFrame
      title={t('pipelines.forYou.title')}
      heading={
        <h1 className="text-20 leading-title font-semibold text-tx">
          {overview.data ? (
            t(greetingId(new Date().getHours()), { name })
          ) : (
            <Skeleton width={220} height={20} />
          )}
        </h1>
      }
      actions={<Pulse overview={overview} />}
    >
      <ActionError error={rerun.error} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="changes-heading" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 id="changes-heading" className="text-16 leading-title font-semibold text-tx">
              {t('pipelines.forYou.changesTitle')}
            </h2>
            {forYou.data ? (
              <span className="text-12 text-tx-3">
                {t('pipelines.forYou.counts', {
                  inFlight: forYou.data.counts.inFlight,
                  shipped: forYou.data.counts.shippedThisWeek,
                })}
              </span>
            ) : null}
            <SegmentedControl
              size="sm"
              className="ms-auto"
              aria-label={t('pipelines.forYou.changesTitle')}
              value={tab}
              onChange={(value) => {
                setSelected(0);
                setTab(value);
              }}
              options={TABS.map((value) => ({
                value,
                label: t(
                  value === 'shipped'
                    ? 'pipelines.forYou.tabShipped'
                    : 'pipelines.forYou.tabInFlight',
                ),
              }))}
            />
          </div>
          {forYou.isError ? (
            <div className="rounded-card border border-line bg-card py-10 shadow-e1">
              <EmptyState
                icon={<Icon name="warning" size={18} />}
                title={t('pipelines.forYou.loadFailed')}
                description={t('pipelines.common.loadFailed')}
                action={
                  <Button onClick={() => void forYou.refetch()}>
                    {t('pipelines.common.tryAgain')}
                  </Button>
                }
              />
            </div>
          ) : !forYou.data ? (
            [0, 1, 2].map((index) => <JourneySkeleton key={index} />)
          ) : journeys.length === 0 ? (
            <div className="rounded-card border border-line bg-card py-10 shadow-e1">
              <EmptyState
                icon={<Icon name="branch" size={18} />}
                title={
                  tab === 'shipped'
                    ? t('pipelines.forYou.shippedEmpty')
                    : t('pipelines.forYou.changesEmpty')
                }
              />
            </div>
          ) : (
            journeys.map((journey, index) => (
              <JourneyCard
                key={journey.id}
                journey={journey}
                selected={index === selected}
                onOpen={() => open(journey)}
                onRerun={() => journey.runId && rerun.mutate(journey.runId)}
                rerunning={rerun.isPending && rerun.variables === journey.runId}
              />
            ))
          )}
        </section>
        <div className="flex flex-col gap-4">
          {forYou.data ? (
            <>
              <WaitingPanel items={forYou.data.waitingForMe} />
              <TeamsPanel teams={forYou.data.myTeams} />
              <OnCallPanel onCall={forYou.data.onCall} />
            </>
          ) : (
            <div className="flex flex-col gap-3 rounded-card border border-line bg-card px-4 py-3 shadow-e1">
              <Skeleton width={120} height={14} />
              <Skeleton width="80%" height={10} />
              <Skeleton width="70%" height={10} />
            </div>
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}
