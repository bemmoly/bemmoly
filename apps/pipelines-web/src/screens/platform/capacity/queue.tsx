import { useT } from '@bemmoly/core-web';
import type { QueueItem } from '@bemmoly/module-pipelines/shared';
import { RunGlyph } from '@bemmoly/ui';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { formatDuration } from '../../../lib/format.ts';

/** What waits and why, longest first: a reason for every wait, in words. */
export function Queue({ items }: { items: readonly QueueItem[] }) {
  const t = useT(pipelinesText);
  if (items.length === 0) {
    return <p className="px-4 pb-4 text-13 text-tx-3">{t('pipelines.capacity.queueEmpty')}</p>;
  }
  return (
    <ul className="flex flex-col px-4 pb-2" aria-label={t('pipelines.capacity.queue')}>
      {items.map((item) => (
        <li
          key={item.jobId}
          className="flex items-center gap-2 border-b border-line-2 py-1.75 text-12 last:border-b-0"
        >
          <RunGlyph state={item.glyph} size={14} label={t(`pipelines.state.${item.glyph}`)} />
          <span className="min-w-0 shrink truncate font-medium text-tx">{item.what}</span>
          <span className="ms-auto min-w-0 shrink truncate text-end text-tx-3">{item.why}</span>
          <span className="w-12 shrink-0 text-end text-tx-3 tabular-nums">
            {formatDuration(item.waitingSeconds)}
          </span>
        </li>
      ))}
    </ul>
  );
}
