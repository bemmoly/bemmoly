import { formatNumber, useT } from '@bemmoly/core-web';
import type { RunSummary } from '@bemmoly/module-pipelines/shared';
import { RelativeTime, Skeleton } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import { pipelinesText } from '../i18n/catalog.ts';
import { formatSpan } from '../lib/format.ts';
import { StateGlyph } from './bits.tsx';

/** The glyph a run's state draws: cancelled reads as skipped, never as failure. */
export function runGlyph(state: RunSummary['state']) {
  return state === 'cancelled' ? 'skipped' : state;
}

/** "main · a1c9e3f · 9m 12s", or "PR #1188 · 77aa01b · lint" for a failure with a summary. */
export function useRunWhere() {
  const t = useT(pipelinesText);
  return (run: RunSummary) =>
    [
      run.pullRequest ? t('pipelines.run.pullRequest', { number: run.pullRequest }) : run.ref,
      run.commitSha.slice(0, 7),
      run.durationSeconds !== null ? formatSpan(run.durationSeconds) : null,
    ]
      .filter(Boolean)
      .join(' · ');
}

/** One run in a short list: an application's recent runs, a team's broken main. */
export function RunLine({ run }: { run: RunSummary }) {
  const t = useT(pipelinesText);
  const where = useRunWhere();
  return (
    <li>
      <Link
        to="/runs/$id"
        params={{ id: run.id }}
        className="flex items-center gap-2 border-b border-line-2 py-2 text-12 text-tx last:border-b-0 hover:bg-hover focus-ring-inset"
      >
        <StateGlyph state={runGlyph(run.state)} />
        <span className="shrink-0 font-medium">
          {t('pipelines.run.number', { number: formatNumber(run.number) })}
        </span>
        <span className="min-w-0 flex-1 truncate text-tx-3">{where(run)}</span>
        <RelativeTime iso={run.createdAt} className="text-tx-3" />
      </Link>
    </li>
  );
}

export function RunLinesSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul aria-busy className="flex flex-col">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-center gap-2 border-b border-line-2 py-2.5">
          <Skeleton width={14} height={14} />
          <Skeleton width={70} height={10} />
          <Skeleton width={`${40 + index * 7}%`} height={10} />
        </li>
      ))}
    </ul>
  );
}
