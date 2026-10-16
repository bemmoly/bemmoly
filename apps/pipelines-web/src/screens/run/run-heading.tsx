import { formatNumber, useT } from '@bemmoly/core-web';
import type { RunDetail } from '@bemmoly/module-pipelines/shared';
import { Skeleton } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import { pipelinesText } from '../../i18n/catalog.ts';
import { formatSpan } from '../../lib/format.ts';
import { StateGlyph } from '../../parts/bits.tsx';
import { runGlyph } from '../../parts/run-line.tsx';

/** "Add idempotency key to refunds · Run 8,812 · pull request · 6m 10s", and its applications. */
export function RunHeading({ run }: { run: RunDetail }) {
  const t = useT(pipelinesText);
  const meta = [
    t('pipelines.run.number', { number: formatNumber(run.number) }),
    t(`pipelines.trigger.${run.trigger}`),
    run.durationSeconds !== null
      ? formatSpan(run.durationSeconds)
      : t(`pipelines.runState.${run.state}`),
  ].join(' · ');
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2.5">
        <StateGlyph state={runGlyph(run.state)} size={18} />
        <h1 className="truncate text-20 leading-title font-semibold text-tx">{run.title}</h1>
        <span className="shrink-0 text-13 text-tx-3 tabular-nums max-sm:hidden">{meta}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 ps-7 text-12 text-tx-3">
        <span className="tabular-nums sm:hidden">{meta}</span>
        {run.applications.map((app) => (
          <Link
            key={app.id}
            to="/applications/$key"
            params={{ key: app.key }}
            className="font-medium"
          >
            {app.name}
          </Link>
        ))}
        {run.supersededByRunId ? (
          <Link to="/runs/$id" params={{ id: run.supersededByRunId }}>
            {t('pipelines.run.superseded')}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function RunSkeleton() {
  return (
    <div aria-busy className="mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 md:px-6">
      <Skeleton width={360} height={20} />
      <Skeleton width="100%" height={180} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_330px]">
        <Skeleton width="100%" height={420} />
        <Skeleton width="100%" height={200} />
      </div>
    </div>
  );
}
