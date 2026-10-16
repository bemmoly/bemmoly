import { formatDate, useT } from '@bemmoly/core-web';
import type { TimelineBucket } from '@bemmoly/module-pipelines/shared';
import { Badge, Button, TimeScrubber, usePhoneWidth } from '@bemmoly/ui';
import { useState } from 'react';
import { pipelinesText } from '../../i18n/catalog.ts';

const time = (iso: string) => formatDate(iso, { hour: '2-digit', minute: '2-digit' });

/**
 * The last 24 hours of deploys under the map, with incidents in red. Dragging previews a
 * moment; letting go rewinds the map there (the address keeps it), and End or L is live.
 */
export function MapTimeline({
  buckets,
  at,
  onCommit,
}: {
  buckets: readonly TimelineBucket[];
  at: string | null;
  onCommit: (at: string | null) => void;
}) {
  const t = useT(pipelinesText);
  const [preview, setPreview] = useState<string | null | undefined>(undefined);
  const value = preview === undefined ? at : preview;
  const parts = usePhoneWidth() ? [0] : [0, 1, 2, 3];
  const ticks = buckets.length
    ? parts.map((part) => Math.floor((part * (buckets.length - 1)) / 4))
    : [];
  return (
    <section
      aria-labelledby="timeline-heading"
      className="flex flex-col gap-2 rounded-card border border-line bg-card px-3.5 py-2.5 shadow-e1"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-12 text-tx-3">
        <h2 id="timeline-heading" className="font-medium text-tx">
          {t('pipelines.map.last24')}
        </h2>
        <span>{t('pipelines.map.perBucket')}</span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-tick bg-red" />
          {t('pipelines.map.incident')}
        </span>
        <span className="ms-auto max-sm:hidden">{t('pipelines.map.dragHint')}</span>
        {value ? (
          <Button size="xs" variant="ghost" onClick={() => onCommit(null)}>
            {t('pipelines.map.backToLive')}
          </Button>
        ) : (
          <Badge tone="accent">{t('pipelines.map.live')}</Badge>
        )}
      </div>
      <TimeScrubber
        buckets={buckets}
        value={value}
        onChange={setPreview}
        onCommit={(next) => {
          setPreview(undefined);
          onCommit(next);
        }}
        ariaLabel={t('pipelines.map.rewindLabel')}
        formatTime={(iso) =>
          formatDate(iso, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
        }
        liveLabel={t('pipelines.map.live')}
        ticks={ticks}
        formatNow={(iso) => t('pipelines.map.now', { time: time(iso) })}
      />
    </section>
  );
}
