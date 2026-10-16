import { useT } from '@bemmoly/core-web';
import type { CloudConnection } from '@bemmoly/module-pipelines/shared';
import { Button, RelativeTime, RunGlyph, type RunGlyphState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useCloudWrites } from '../../../hooks/use-clouds.ts';
import { useGo } from '../../../hooks/use-go.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { LAYOUT_LABEL } from './layout-words.ts';

const GLYPH: Record<CloudConnection['status'], RunGlyphState> = {
  pending: 'running',
  connected: 'passed',
  failed: 'waiting',
  disconnected: 'skipped',
};

export const unitOf = (provider: string) => (provider === 'gcp' ? 'project' : 'other');

/**
 * One connected cloud: who Pipelines acts as there, the boundary it works inside and its
 * layout. When the last check failed, one amber band says so with Reconnect, and what is on
 * screen stays as last known.
 */
export function ConnectionCard({ connection }: { connection: CloudConnection }) {
  const t = useT(pipelinesText);
  const go = useGo();
  const { check } = useCloudWrites();
  const unit = unitOf(connection.provider);
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-card p-4 shadow-e1">
      {connection.status === 'failed' && (
        <div className="-mx-4 -mt-4 flex flex-wrap items-center gap-3 rounded-t-card bg-amber-50 px-4 py-2.5">
          <p className="min-w-0 flex-1 text-12 text-amber-tx">
            {t('pipelines.clouds.failedBand', {
              name: connection.name,
              error: connection.lastError ?? '',
            })}
          </p>
          <Button
            size="xs"
            variant="secondary"
            loading={check.isPending}
            onClick={() => check.mutate(connection.id)}
          >
            {t('pipelines.clouds.reconnect')}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Icon name="cloud" size={18} className="text-tx-2" />
        <h2 className="text-16 font-semibold text-tx">{connection.name}</h2>
        <span className="flex items-center gap-1.5 text-12 text-tx-2">
          <RunGlyph state={GLYPH[connection.status]} size={14} />
          {t(`pipelines.clouds.status.${connection.status}`)}
        </span>
        {connection.lastCheckedAt && (
          <span className="text-12 text-tx-3">
            {t('pipelines.clouds.checked')} <RelativeTime iso={connection.lastCheckedAt} />
          </span>
        )}
        <div className="ms-auto flex gap-2">
          {connection.status !== 'failed' && (
            <Button
              size="xs"
              variant="ghost"
              loading={check.isPending}
              onClick={() => check.mutate(connection.id)}
            >
              {t('pipelines.clouds.checkNow')}
            </Button>
          )}
          <Button
            size="xs"
            variant="secondary"
            onClick={() =>
              go({ to: '/platform/clouds/connect', search: { connection: connection.id } })
            }
          >
            {t('pipelines.clouds.changeLayout')}
          </Button>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-12 sm:grid-cols-3">
        {connection.principal && (
          <dd className="truncate text-tx-2">
            {t('pipelines.clouds.as', { principal: connection.principal })}
          </dd>
        )}
        {connection.boundary && (
          <dd className="truncate text-tx-2">
            {t('pipelines.clouds.boundary', { boundary: connection.boundary })}
          </dd>
        )}
        <dd className="truncate text-tx-2">
          {t('pipelines.clouds.layoutNow', {
            layout: t(LAYOUT_LABEL[connection.layout], { unit }),
          })}
        </dd>
      </dl>
    </section>
  );
}
