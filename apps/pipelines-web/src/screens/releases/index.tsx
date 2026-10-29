import { useShortcutHelp, useT } from '@bemmoly/core-web';
import { SegmentedControl } from '@bemmoly/ui';
import { topicOf } from '@bemmoly/module-pipelines/shared';
import { useScope } from '../../hooks/use-scope.ts';
import { useSearchState } from '../../hooks/use-search-state.ts';
import { useAwaitingMe, useShippingStream } from '../../hooks/use-shipping.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { LoadFailed } from '../../parts/load-failed.tsx';
import { RowsSkeleton } from '../../parts/rows-skeleton.tsx';
import { Panel, Screen } from '../../parts/screen.tsx';
import { useScopeName } from '../screen-frame.tsx';
import { PromotionsTable } from './promotions-table.tsx';
import { ReleasesTable } from './releases-table.tsx';
import { ReleasesTabs } from './tabs.tsx';
import { Waiting } from './waiting.tsx';

const VIEWS = ['promotions', 'releases'] as const;

/**
 * Releases: what is waiting for this person's approval first, then every promotion in the
 * scope and every release, newest first. Live: a promotion that moves refetches the lists.
 */
export default function ReleasesScreen() {
  const t = useT(pipelinesText);
  const { path } = useScope();
  const scopeName = useScopeName();
  const [view, setView] = useSearchState('view', VIEWS, 'promotions');
  const waiting = useAwaitingMe();
  useShippingStream([topicOf.forYou()]);
  useShortcutHelp({
    id: 'pipelines.releases',
    label: t('pipelines.releases.title'),
    keys: [
      { keys: 'J K', label: t('pipelines.keys.moveRows') },
      { keys: 'Enter', label: t('pipelines.keys.openRow') },
    ],
  });
  const count = waiting.data?.items.length ?? 0;
  return (
    <Screen title={t('pipelines.releases.title')}>
      <ReleasesTabs />
      <Panel
        flush
        title={t('pipelines.releases.waitingTitle')}
        meta={count > 0 && t('pipelines.releases.waitingMeta', { count })}
      >
        {waiting.isError ? (
          <LoadFailed
            bare
            size="sm"
            className="m-3"
            error={waiting.error}
            onRetry={() => void waiting.refetch()}
          />
        ) : !waiting.data ? (
          <RowsSkeleton columns={4} rows={3} />
        ) : count === 0 ? (
          <p className="px-4 pb-4 text-13 text-tx-3">{t('pipelines.releases.waitingEmpty')}</p>
        ) : (
          <Waiting items={waiting.data.items} />
        )}
      </Panel>
      <Panel
        flush
        title={t(
          view === 'releases' ? 'pipelines.releases.releases' : 'pipelines.releases.promotions',
        )}
        meta={scopeName}
        actions={
          <SegmentedControl
            size="sm"
            aria-label={t('pipelines.releases.viewLabel')}
            options={[
              { value: 'promotions', label: t('pipelines.releases.promotions') },
              { value: 'releases', label: t('pipelines.releases.releases') },
            ]}
            value={view}
            onChange={setView}
          />
        }
      >
        {view === 'releases' ? (
          <ReleasesTable scope={path} scopeName={scopeName} />
        ) : (
          <PromotionsTable scope={path} scopeName={scopeName} />
        )}
      </Panel>
    </Screen>
  );
}
