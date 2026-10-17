import { useT } from '@bemmoly/core-web';
import type { RunsPage } from '@bemmoly/module-pipelines/shared';
import { Button } from '@bemmoly/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import { pipelinesText } from '../../i18n/catalog.ts';
import { RunLine, RunLinesSkeleton } from '../../parts/run-line.tsx';

export function RecentRuns({ runs, onAll }: { runs: UseQueryResult<RunsPage>; onAll: () => void }) {
  const t = useT(pipelinesText);
  if (runs.isPending) return <RunLinesSkeleton />;
  if (runs.isError)
    return (
      <p className="flex items-center gap-3 text-13 text-tx-2">
        {t('pipelines.common.loadFailed')}
        <Button size="sm" variant="ghost" onClick={() => void runs.refetch()}>
          {t('pipelines.common.tryAgain')}
        </Button>
      </p>
    );
  if (runs.data.items.length === 0)
    return <p className="text-13 text-tx-3">{t('pipelines.application.noRuns')}</p>;
  return (
    <div className="flex flex-col">
      <ul className="flex flex-col">
        {runs.data.items.map((run) => (
          <RunLine key={run.id} run={run} />
        ))}
      </ul>
      <Button size="sm" variant="ghost" className="mt-1 self-start" onClick={onAll}>
        {t('pipelines.application.allRuns')}
      </Button>
    </div>
  );
}
