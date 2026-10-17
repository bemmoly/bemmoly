import { formatDate, formatNumber, useT } from '@bemmoly/core-web';
import type { ChangesResponse } from '@bemmoly/module-pipelines/shared';
import { SeriesChart, usePhoneWidth, type SeriesMarker } from '@bemmoly/ui';
import { pipelinesText } from '../../i18n/catalog.ts';
import { Panel } from '../../parts/screen.tsx';
import { riseOf } from './rise.ts';

/** Changes that are drawn on the chart: the ones that ship or move code and config. */
const MARKED = new Set(['deploy', 'rollback', 'config', 'environment', 'infrastructure']);

/**
 * The error rate over the window with every deploy and config change marked where it
 * landed; one that landed just before the rise is marked amber, by timing alone.
 */
export function ChangesChart({ changes }: { changes: ChangesResponse }) {
  const t = useT(pipelinesText);
  const time = (iso: string) => formatDate(iso, { hour: '2-digit', minute: '2-digit' });
  const percent = (value: number) => `${formatNumber(value, { maximumFractionDigits: 1 })}%`;
  const phone = usePhoneWidth();
  const { series } = changes;
  const rise = riseOf(series);
  const markers: SeriesMarker[] = changes.items
    .filter((item) => MARKED.has(item.kind))
    .slice(0, 12)
    .map((item) => ({
      key: item.id,
      at: Date.parse(item.occurredAt),
      label: item.application?.name ?? item.summary,
      tone: item.beforeRiseMinutes !== null ? 'warn' : 'muted',
    }));
  return (
    <Panel
      title={series.label}
      meta={t('pipelines.changes.chartRange', { from: time(changes.from) })}
      actions={
        rise && (
          <span className="rounded-chip bg-red-50 px-1.5 py-0.5 text-11 font-semibold text-red-tx">
            {t('pipelines.changes.rise', {
              from: percent(rise.from),
              to: percent(rise.to),
              at: time(rise.at),
            })}
          </span>
        )
      }
    >
      {series.source === 'unavailable' ? (
        <p className="py-2 text-13 text-tx-3">{t('pipelines.changes.noMetrics')}</p>
      ) : (
        <SeriesChart
          tone="danger"
          height={150}
          range={[Date.parse(changes.from), Date.parse(changes.to)]}
          points={series.points.map(([at, value]) => ({ at: Date.parse(at), value }))}
          markers={markers}
          markerLabels={!phone}
          ariaLabel={
            rise
              ? t('pipelines.changes.chartLabelRise', {
                  label: series.label,
                  from: percent(rise.from),
                  to: percent(rise.to),
                  at: time(rise.at),
                })
              : series.label
          }
        />
      )}
    </Panel>
  );
}
