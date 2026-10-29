import { useT } from '@bemmoly/core-web';
import type { CloudConnection } from '@bemmoly/module-pipelines/shared';
import { Button, RelativeTime, RunGlyph, Tag } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useEffect, useRef } from 'react';
import { useCloudWrites } from '../../../hooks/use-clouds.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { AttachedProjects } from './attached-projects.tsx';
import { SIGN_IN_LABEL } from './connect-attached.tsx';
import { CONNECTION_GLYPH, FailedBand } from './connection-card.tsx';
import { RegistryRow } from './registry-row.tsx';

/**
 * A connection that uses projects the company already has: how Bemmoly signs in, the region
 * services default to and the registry runners push to, then the projects attached to it with
 * what each check found. `arrived` is the card just connected: it is brought into view and its
 * first check shows as it runs, then its result.
 */
export function AttachedCard({
  connection,
  arrived = false,
  checking = false,
}: {
  connection: CloudConnection;
  arrived?: boolean;
  checking?: boolean;
}) {
  const t = useT(pipelinesText);
  const { check } = useCloudWrites();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (arrived) ref.current?.scrollIntoView({ block: 'start' });
  }, [arrived]);
  const busy = checking || check.isPending;
  const status = busy ? 'pending' : connection.status;
  return (
    <div className="flex flex-col gap-3">
      <section
        ref={ref}
        aria-label={connection.name}
        className="flex scroll-mt-4 flex-col gap-3 rounded-card border border-line bg-card p-4 shadow-e1"
      >
        {connection.status === 'failed' && !busy && (
          <FailedBand
            connection={connection}
            busy={busy}
            onReconnect={() => check.mutate(connection.id)}
          />
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Icon name="cloud" size={18} className="text-tx-2" />
          <h2 className="text-16 font-semibold text-tx">{connection.name}</h2>
          <Tag size="sm">{t('pipelines.clouds.mode.attachedShort')}</Tag>
          <span role="status" className="flex items-center gap-1.5 text-12 text-tx-2">
            <RunGlyph state={CONNECTION_GLYPH[status]} size={14} />
            {t(`pipelines.clouds.status.${status}`)}
          </span>
          {connection.lastCheckedAt && !busy && (
            <span className="text-12 text-tx-3">
              {t('pipelines.clouds.checked')} <RelativeTime iso={connection.lastCheckedAt} />
            </span>
          )}
          <div className="ms-auto flex gap-2">
            {connection.status !== 'failed' && (
              <Button
                size="xs"
                variant="ghost"
                loading={busy}
                onClick={() => check.mutate(connection.id)}
              >
                {t('pipelines.clouds.checkNow')}
              </Button>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-12 sm:grid-cols-3">
          <div className="flex min-w-0 gap-1.5">
            <dt className="shrink-0 text-tx-3">{t('pipelines.clouds.signInShort')}</dt>
            <dd className="truncate text-tx-2">
              {connection.signIn ? t(SIGN_IN_LABEL[connection.signIn]) : t('pipelines.common.none')}
            </dd>
          </div>
          <div className="flex min-w-0 gap-1.5">
            <dt className="shrink-0 text-tx-3">{t('pipelines.clouds.region')}</dt>
            <dd className="truncate font-mono text-tx-2">
              {connection.region ?? t('pipelines.common.none')}
            </dd>
          </div>
          {connection.principal && (
            <dd className="truncate text-tx-2">
              {t('pipelines.clouds.as', { principal: connection.principal })}
            </dd>
          )}
        </dl>
        <RegistryRow connection={connection} />
      </section>
      <AttachedProjects connection={connection} />
    </div>
  );
}
