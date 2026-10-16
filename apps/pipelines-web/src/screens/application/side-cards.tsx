import { formatNumber, useT } from '@bemmoly/core-web';
import type {
  Application,
  EnvironmentStripItem,
  MetricPoint,
} from '@bemmoly/module-pipelines/shared';
import { Badge, MetricCompare, Skeleton } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { pipelinesText } from '../../i18n/catalog.ts';
import { formatShare, formatSpan } from '../../lib/format.ts';
import { RUNTIME_WORD, StateGlyph, TeamMark } from '../../parts/bits.tsx';
import { useCanary } from './use-application.ts';

const points = (series: readonly MetricPoint[]) =>
  series.map(([at, value]) => ({ at: Date.parse(at), value }));

export const SIDE_CARD =
  'flex flex-col gap-2 rounded-card border border-line bg-card px-4 py-3.5 shadow-e1';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 py-1 text-12">
      <dt className="w-21 shrink-0 text-tx-3">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-tx">{children}</dd>
    </div>
  );
}

/** Who owns it, where it lives, what it is built from and how its last month went. */
export function AboutCard({ app }: { app: Application }) {
  const t = useT(pipelinesText);
  const deploys = app.delivery.deploysByWeek.slice(-4).reduce((sum, value) => sum + value, 0);
  return (
    <section className={SIDE_CARD} aria-labelledby="about-heading">
      <h2 id="about-heading" className="text-16 leading-title font-semibold text-tx">
        {t('pipelines.application.about')}
      </h2>
      <dl>
        <Row label={t('pipelines.application.owner')}>
          {app.ownerTeam ? (
            <>
              <TeamMark name={app.ownerTeam.name} />
              <span className="truncate">{app.ownerTeam.name}</span>
            </>
          ) : (
            <span className="text-amber-tx">{t('pipelines.catalog.noOwner')}</span>
          )}
        </Row>
        {app.repository ? (
          <Row label={t('pipelines.application.repository')}>
            <span className="truncate font-mono">{app.repository.fullName}</span>
            {app.path ? <span className="truncate text-tx-3">{app.path}</span> : null}
          </Row>
        ) : null}
        {app.templateRef ? (
          <Row label={t('pipelines.application.template')}>
            <span className="truncate font-mono">{app.templateRef}</span>
          </Row>
        ) : null}
        <Row label={t('pipelines.application.runtime')}>
          {t(RUNTIME_WORD[app.runtime])} · {t(`pipelines.lifecycle.${app.lifecycle}`)}
        </Row>
        <Row label={t('pipelines.application.lastMonth')}>
          <span className="truncate">
            {[
              t('pipelines.application.deploys', { count: deploys, shown: formatNumber(deploys) }),
              app.delivery.leadTimeSeconds !== null
                ? t('pipelines.application.leadTime', {
                    time: formatSpan(app.delivery.leadTimeSeconds),
                  })
                : null,
              app.delivery.changeFailureRate !== null
                ? t('pipelines.application.changeFailure', {
                    rate: formatShare(app.delivery.changeFailureRate),
                  })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </Row>
      </dl>
      {app.labels.length ? (
        <div className="flex flex-wrap gap-1.5">
          {app.labels.map((label) => (
            <Badge key={label}>{label}</Badge>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Canary against stable where a release is moving into Prod; otherwise the application's
 * health. The verdict per metric is the server's; the card only shows it.
 */
export function HealthCard({
  app,
  prod,
}: {
  app: Application;
  prod: EnvironmentStripItem | undefined;
}) {
  const t = useT(pipelinesText);
  const canaryId = prod?.state === 'canary' ? prod.deploymentId : null;
  const canary = useCanary(canaryId);
  const value = (amount: number | null, unit: string) =>
    amount === null
      ? t('pipelines.common.none')
      : t('pipelines.metric.value', { value: formatNumber(amount), unit });
  return (
    <section className={SIDE_CARD} aria-labelledby="health-heading">
      <div className="flex items-baseline gap-2">
        <h2 id="health-heading" className="text-16 leading-title font-semibold text-tx">
          {t('pipelines.application.prodHealth')}
        </h2>
        {canaryId && prod ? (
          <span className="ms-auto truncate text-12 text-tx-3">
            {t('pipelines.application.canaryVsStable', { env: prod.environment.name })}
          </span>
        ) : null}
      </div>
      {!canaryId ? (
        <p className="flex items-center gap-2 text-13 text-tx-2">
          <StateGlyph
            state={
              app.health === 'failing'
                ? 'failed'
                : app.health === 'degraded'
                  ? 'waiting'
                  : app.health === 'healthy'
                    ? 'passed'
                    : 'queued'
            }
          />
          {t(`pipelines.health.${app.health}`)}
        </p>
      ) : canary.isPending ? (
        <Skeleton width="80%" height={12} />
      ) : canary.isError ? (
        <p className="text-13 text-tx-2">{t('pipelines.common.loadFailed')}</p>
      ) : canary.data.source === 'unavailable' ? (
        <p className="text-13 text-tx-2">{t('pipelines.application.noMetrics')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {canary.data.metrics.map((metric) => (
            <MetricCompare
              key={metric.metric}
              label={t(`pipelines.metric.${metric.metric}`)}
              canary={{
                label: t('pipelines.application.canarySide', {
                  percent: canary.data.trafficPercent,
                }),
                value:
                  metric.canary.value === null ? null : value(metric.canary.value, metric.unit),
                series: points(metric.canary.series),
              }}
              stable={{
                label: t('pipelines.application.stableSide'),
                value:
                  metric.stable.value === null ? null : value(metric.stable.value, metric.unit),
                series: points(metric.stable.series),
              }}
              verdict={metric.verdict}
              verdictLabel={t(`pipelines.verdict.${metric.verdict}`)}
              emptyValue={t('pipelines.application.noSample')}
            />
          ))}
        </div>
      )}
    </section>
  );
}
