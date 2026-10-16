import { formatNumber, useGlobalKeys, useT } from '@bemmoly/core-web';
import type {
  CanaryVerdict,
  Deployment,
  MetricCompare as Metric,
} from '@bemmoly/module-pipelines/shared';
import { Button, Kbd, MetricCompare, useToast } from '@bemmoly/ui';
import { useCanary, useShippingWrites } from '../../hooks/use-shipping.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { refusalOf } from '../../parts/load-failed.tsx';

const VERDICT = {
  pass: 'pipelines.canary.pass',
  marginal: 'pipelines.canary.marginal',
  fail: 'pipelines.canary.fail',
  pending: 'pipelines.canary.pending',
} as const satisfies Record<CanaryVerdict, string>;

const METRIC = {
  error_rate: 'pipelines.canary.errorRate',
  latency_p95: 'pipelines.canary.latency',
} as const;

/**
 * The canary judged against stable while it runs: a card per metric with both lines and the
 * verdict. A marginal step pauses for a person, who carries on or rolls back from here.
 */
export function CanaryHealth({ deployment }: { deployment: Deployment }) {
  const t = useT(pipelinesText);
  const toast = useToast();
  const canary = useCanary(deployment.id);
  const { resume, rollback } = useShippingWrites();
  const rollBack = () =>
    rollback.mutate(
      { deployment: deployment.id, body: {} },
      {
        onSuccess: () => toast.show({ tone: 'ok', title: t('pipelines.canary.rolledBack') }),
        onError: (error) =>
          toast.show({
            tone: 'danger',
            title: t('pipelines.canary.rollbackFailed'),
            body: refusalOf(error)?.sentence ?? t('pipelines.common.loadFailed'),
          }),
      },
    );
  useGlobalKeys({ 'shift+b': rollBack });
  const value = (metric: Metric, raw: number | null) =>
    raw === null
      ? null
      : t(metric.unit === '%' ? 'pipelines.canary.percent' : 'pipelines.canary.ms', {
          value: formatNumber(raw, { maximumFractionDigits: metric.unit === '%' ? 2 : 0 }),
        });
  const decide = (decision: 'continue') =>
    resume.mutate(
      { id: deployment.id, body: { decision } },
      {
        onError: (error) =>
          toast.show({
            tone: 'danger',
            title: t('pipelines.canary.decideFailed'),
            body: refusalOf(error)?.sentence ?? t('pipelines.common.loadFailed'),
          }),
      },
    );
  const data = canary.data;
  return (
    <section className="mt-4 flex flex-col gap-3 border-t border-line-2 pt-3">
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 text-11 font-semibold text-tx-2">
          {t('pipelines.canary.title', {
            environment: deployment.environment.name,
            traffic: deployment.trafficPercent,
          })}
        </h3>
        <Button size="xs" variant="danger" loading={rollback.isPending} onClick={rollBack}>
          {t('pipelines.canary.rollBack')}
          <span className="hidden md:inline-flex">
            <Kbd keys="Shift+B" />
          </span>
        </Button>
      </div>
      {deployment.phase === 'paused' && (
        <div className="flex flex-col gap-2 rounded-control bg-amber-50 px-3 py-2.5">
          <p className="text-12 text-amber-tx">
            {deployment.pauseReason ?? t('pipelines.canary.paused')}
          </p>
          <div className="flex gap-2">
            <Button size="xs" loading={resume.isPending} onClick={() => decide('continue')}>
              {t('pipelines.canary.continue')}
            </Button>
          </div>
        </div>
      )}
      {data?.source === 'unavailable' && (
        <p className="text-12 text-tx-3">{t('pipelines.canary.noMetrics')}</p>
      )}
      {data?.source === 'metrics' &&
        data.metrics.map((metric) => (
          <MetricCompare
            key={metric.metric}
            label={t(METRIC[metric.metric])}
            canary={{
              label: t('pipelines.canary.canarySide', { traffic: data.trafficPercent }),
              value: value(metric, metric.canary.value),
              series: metric.canary.series.map(([at, v]) => ({ at: Date.parse(at), value: v })),
            }}
            stable={{
              label: t('pipelines.canary.stableSide'),
              value: value(metric, metric.stable.value),
              series: metric.stable.series.map(([at, v]) => ({ at: Date.parse(at), value: v })),
            }}
            verdict={metric.verdict}
            verdictLabel={t(VERDICT[metric.verdict])}
            emptyValue={t('pipelines.canary.noData')}
          />
        ))}
    </section>
  );
}
