import { formatNumber, useScreenActions, useT } from '@bemmoly/core-web';
import type { RunDetail, RunGraph } from '@bemmoly/module-pipelines/shared';
import { Button, EmptyState, Skeleton, StageGraph, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { deliveryKeys } from '../../api/delivery.ts';
import { useScreenKeys } from '../../hooks/use-screen-keys.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { api } from '../../lib/api.ts';
import { ActionError } from '../../parts/action-error.tsx';
import { ScreenFrame } from '../screen-frame.tsx';
import { LogPanel } from './log-panel.tsx';
import { RunHeading, RunSkeleton } from './run-heading.tsx';
import { ChangeCard, FailuresCard } from './run-side.tsx';
import { useRun } from './use-run.ts';

/** The node a run opens on: the address's, else the graph's focus, else the first. */
function pickNode(graph: RunGraph | undefined, wanted: string | undefined) {
  const nodes = graph?.stages.flatMap((stage) => stage.nodes) ?? [];
  return (
    nodes.find((node) => node.key === wanted) ??
    nodes.find((node) => node.key === graph?.focus) ??
    nodes[0]
  );
}

/**
 * A run: its stages as a graph, the selected job's log opened on the failure, the failed tests
 * by name, and Re-run failed at hand. The address holds the node and the line.
 */
export default function RunScreen() {
  const t = useT(pipelinesText);
  const toast = useToast();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { id = '' } = useParams({ strict: false }) as { id?: string };
  const search = useSearch({ strict: false }) as { node?: string; line?: number | string };
  const { run, graph } = useRun(id);
  const [follow, setFollow] = useState(false);
  const logSearch = useRef<HTMLInputElement>(null);
  const node = pickNode(graph.data, search.node);
  const job = run.data?.jobs.find((item) => item.id === node?.jobId);
  const line = search.line ? Number(search.line) || null : null;
  const set = (next: Record<string, string | number | undefined>) =>
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({ ...previous, ...next }),
      replace: true,
    });

  const rerun = useMutation({
    mutationFn: (only: 'failed' | 'all') => api.delivery.rerun(id, { only }),
    onSuccess: (created, only) => {
      toast.show({
        tone: 'ok',
        title: t(only === 'failed' ? 'pipelines.run.reranFailed' : 'pipelines.run.reranAll', {
          number: formatNumber(created.number),
        }),
      });
      void client.invalidateQueries({ queryKey: ['pipelines', 'runs'] });
      void navigate({ to: '/runs/$id', params: { id: created.id }, search: {} });
    },
  });
  const cancel = useMutation({
    mutationFn: () => api.delivery.cancelRun(id, {}),
    onSuccess: () => void client.invalidateQueries({ queryKey: deliveryKeys.run(id) }),
  });
  const failed = run.data?.state === 'failed';
  const active = run.data && ['queued', 'running', 'waiting'].includes(run.data.state);
  const nodes = graph.data?.stages.flatMap((stage) => stage.nodes) ?? [];
  const move = (by: number) => {
    const index = nodes.findIndex((item) => item.key === node?.key);
    const next = nodes[index + by];
    if (next) set({ node: next.key, line: undefined });
  };

  useScreenKeys({
    'shift+r': () => failed && !rerun.isPending && rerun.mutate('failed'),
    f: () => setFollow((value) => !value),
    '/': () => logSearch.current?.focus(),
    j: () => move(1),
    k: () => move(-1),
  });
  useScreenActions(
    run.data
      ? [
          ...(failed
            ? [
                {
                  id: 'run.rerunFailed',
                  title: t('pipelines.run.rerunFailed'),
                  keys: 'Shift+R',
                  run: () => rerun.mutate('failed'),
                },
              ]
            : []),
          {
            id: 'run.rerunAll',
            title: t('pipelines.run.rerunAll'),
            run: () => rerun.mutate('all'),
          },
          {
            id: 'run.follow',
            title: t('pipelines.log.follow'),
            keys: 'F',
            run: () => setFollow((value) => !value),
          },
          {
            id: 'run.search',
            title: t('pipelines.log.search'),
            keys: '/',
            run: () => logSearch.current?.focus(),
          },
        ]
      : null,
  );

  if (run.isError) {
    const missing = (run.error as { code?: string }).code === 'not_found';
    return (
      <ScreenFrame title={t('pipelines.run.title')}>
        <div className="rounded-card border border-line bg-card py-12 shadow-e1">
          <EmptyState
            icon={<Icon name={missing ? 'play' : 'warning'} size={18} />}
            title={missing ? t('pipelines.run.notFound') : t('pipelines.run.loadFailed')}
            description={
              missing ? t('pipelines.run.notFoundHint') : t('pipelines.common.loadFailed')
            }
            headingLevel={2}
            action={
              missing ? (
                <Button onClick={() => void navigate({ to: '/runs' })}>
                  {t('pipelines.run.allRuns')}
                </Button>
              ) : (
                <Button onClick={() => void run.refetch()}>{t('pipelines.common.tryAgain')}</Button>
              )
            }
          />
        </div>
      </ScreenFrame>
    );
  }
  const data: RunDetail | undefined = run.data;
  if (!data) return <RunSkeleton />;
  return (
    <ScreenFrame
      title={data.title}
      heading={<RunHeading run={data} />}
      actions={
        <>
          {active ? (
            <Button variant="ghost" onClick={() => cancel.mutate()} loading={cancel.isPending}>
              {t('pipelines.run.cancel')}
            </Button>
          ) : null}
          <Button
            onClick={() => rerun.mutate('all')}
            loading={rerun.isPending && rerun.variables === 'all'}
          >
            <Icon name="undo" size={14} />
            {t('pipelines.run.rerunAll')}
          </Button>
        </>
      }
    >
      <ActionError error={rerun.error ?? cancel.error} />
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
            selectedId={node?.key ?? null}
            onSelect={(key) => set({ node: key, line: undefined })}
            ariaLabel={t('pipelines.run.graphLabel')}
            stateLabel={(state) => t(`pipelines.state.${state}`)}
          />
        )}
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_330px]">
        {data.executor === 'external' && data.externalUrl ? (
          <div className="rounded-card border border-line bg-card py-10 shadow-e1">
            <EmptyState
              icon={<Icon name="external" size={18} />}
              title={t('pipelines.run.externalTitle')}
              description={t('pipelines.run.externalDescription')}
              action={
                <Button onClick={() => window.open(data.externalUrl ?? '', '_blank', 'noopener')}>
                  {t('pipelines.run.openExternal')}
                </Button>
              }
            />
          </div>
        ) : job ? (
          <LogPanel
            key={job.id}
            job={job}
            line={line}
            onLine={(number) => set({ line: number })}
            follow={follow}
            onFollow={setFollow}
            searchRef={logSearch}
          />
        ) : (
          <Skeleton width="100%" height={320} />
        )}
        <div className="flex flex-col gap-3">
          <FailuresCard
            run={data}
            onRerunFailed={() => rerun.mutate('failed')}
            rerunning={rerun.isPending && rerun.variables === 'failed'}
            onOpenJob={(jobId) => {
              const target = nodes.find((item) => item.jobId === jobId);
              if (target) set({ node: target.key, line: undefined });
            }}
          />
          <ChangeCard run={data} />
        </div>
      </div>
    </ScreenFrame>
  );
}
