import { formatNumber, useT } from '@bemmoly/core-web';
import { RunGlyph } from '@bemmoly/ui';
import { useOverview } from '../hooks/use-overview.ts';
import { useLiveCounter } from '../hooks/use-stream.ts';
import { pipelinesText } from '../i18n/catalog.ts';

/**
 * "214 running · 38 queued" for the whole organisation, live over the stream. It starts from
 * the overview read and then follows the coalesced counter events.
 */
export function LiveCounter({ compact = false }: { compact?: boolean }) {
  const t = useT(pipelinesText);
  const overview = useOverview('');
  const live = useLiveCounter(overview.data?.live);
  if (!live) return <span aria-hidden className="h-4 w-36 rounded-chip bg-sunken" />;
  const label = t('pipelines.shell.liveCounterLabel', live);
  return (
    <span
      role="status"
      aria-label={label}
      className="flex shrink-0 items-center gap-1.5 text-12 text-tx-2 tabular-nums"
    >
      <RunGlyph state="running" size={14} />
      {compact ? (
        <span aria-hidden className="font-semibold text-tx">
          {formatNumber(live.running)}
        </span>
      ) : (
        <span aria-hidden>{t('pipelines.shell.liveCounter', live)}</span>
      )}
    </span>
  );
}
