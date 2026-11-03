import { useT } from '@bemmoly/core-web';
import type { RunGraph } from '@bemmoly/module-pipelines/shared';
import { Button, Skeleton, StageGraph } from '@bemmoly/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import { pipelinesText } from '../../i18n/catalog.ts';

/** A run's jobs as a graph, grouped by environment when the pipeline has environment steps. */
export function RunGraphCard({
  graph,
  selected,
  onSelect,
}: {
  graph: UseQueryResult<RunGraph>;
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const t = useT(pipelinesText);
  return (
    <div className="rounded-card border border-line bg-card px-4 py-3.5 shadow-e1">
      {graph.isPending ? (
        <div aria-busy className="flex gap-6">
          {[1, 2, 3, 2].map((count, column) => (
            <div key={column} className="flex flex-col justify-center gap-2">
              {Array.from({ length: count }, (_, row) => (
                <Skeleton key={row} width={168} height={46} />
              ))}
            </div>
          ))}
        </div>
      ) : graph.isError ? (
        <p className="flex items-center gap-3 text-13 text-tx-2">
          {t('pipelines.run.graphFailed')}
          <Button size="sm" variant="ghost" onClick={() => void graph.refetch()}>
            {t('pipelines.common.tryAgain')}
          </Button>
        </p>
      ) : (
        <StageGraph
          stages={graph.data.stages.map((stage) => ({
            index: stage.index,
            nodes: stage.nodes.map((item) => ({
              id: item.key,
              name: item.name,
              state: item.state,
              detail: item.detail,
            })),
          }))}
          edges={graph.data.edges}
          groups={graph.data.groups.map((group) => ({
            id: group.environment ?? 'build',
            label: group.name,
            detail: group.where,
            stages: group.stages,
          }))}
          selectedId={selected}
          onSelect={onSelect}
          ariaLabel={t('pipelines.run.graphLabel')}
          stateLabel={(state) => t(`pipelines.state.${state}`)}
        />
      )}
    </div>
  );
}
