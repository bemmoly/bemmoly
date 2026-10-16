import { useT, useShortcutHelp } from '@bemmoly/core-web';
import type { ListRunsQuery } from '@bemmoly/module-pipelines/shared';
import { Button, EmptyState, SearchInput, SegmentedControl, Switch } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useRef } from 'react';
import { useDraft } from '../../hooks/use-draft.ts';
import { useScope } from '../../hooks/use-scope.ts';
import { useScreenKeys } from '../../hooks/use-screen-keys.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { LoadError } from '../../parts/load-error.tsx';
import { RunsTable, RunsTableSkeleton } from './runs-table.tsx';
import { RUN_FILTERS, useRuns, type RunFilter } from './use-runs.ts';

/**
 * Runs, filtered by state, by "mine" and by text, all in the address. Used by the Runs screen
 * for the scope, and by an application's Runs tab with the application fixed.
 */
export function RunsList({ fixed }: { fixed?: Partial<ListRunsQuery> }) {
  const t = useT(pipelinesText);
  const navigate = useNavigate();
  const scope = useScope();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const filter: RunFilter =
    typeof search['state'] === 'string' && search['state'] in RUN_FILTERS
      ? (search['state'] as RunFilter)
      : 'all';
  const mine = search['mine'] === true || search['mine'] === 'true';
  const q = typeof search['q'] === 'string' ? search['q'] : '';
  const box = useRef<HTMLInputElement>(null);
  const set = (next: Record<string, string | undefined>, replace = false) =>
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({ ...previous, ...next }),
      replace,
    });
  const [text, setText] = useDraft(q, (next) => set({ q: next || undefined }, true));
  const states = RUN_FILTERS[filter];
  const query: Partial<ListRunsQuery> = {
    ...(fixed ?? (scope.path ? { scope: scope.path } : {})),
    ...(states ? { state: states } : {}),
    ...(mine ? { mine: true } : {}),
    ...(q ? { q } : {}),
  };
  const runs = useRuns(query);
  const rows = runs.data?.pages.flatMap((page) => page.items) ?? [];
  useShortcutHelp({
    id: 'pipelines.runs',
    label: t('pipelines.keys.runs'),
    keys: [
      { keys: '/', label: t('pipelines.runs.searchPlaceholder') },
      { keys: 'J K', label: t('pipelines.keys.moveRows') },
      { keys: 'Enter', label: t('pipelines.keys.openRow') },
    ],
  });
  useScreenKeys({
    '/': () => box.current?.focus(),
    j: () =>
      document.querySelector<HTMLElement>('[role="rowgroup"] [role="row"][tabindex]')?.focus(),
  });
  const filtered = filter !== 'all' || mine || q;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          size="sm"
          aria-label={t('pipelines.runs.filterLabel')}
          value={filter}
          onChange={(value) => set({ state: value === 'all' ? undefined : value })}
          options={(Object.keys(RUN_FILTERS) as RunFilter[]).map((value) => ({
            value,
            label: t(`pipelines.runs.filter.${value}`),
          }))}
        />
        <label className="flex items-center gap-2 text-12 text-tx-2">
          <Switch
            checked={mine}
            onCheckedChange={(on) => set({ mine: on ? 'true' : undefined })}
            size="sm"
          />
          {t('pipelines.runs.mine')}
        </label>
        <div className="w-full sm:ms-auto sm:w-64">
          <SearchInput
            ref={box}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('pipelines.runs.searchPlaceholder')}
            aria-label={t('pipelines.runs.searchPlaceholder')}
            hint="/"
            className="w-full"
          />
        </div>
      </div>
      {runs.isError ? (
        <LoadError
          title={t('pipelines.runs.errorTitle')}
          error={runs.error}
          onRetry={() => void runs.refetch()}
        />
      ) : runs.isPending ? (
        <RunsTableSkeleton showApplication={!fixed?.application} />
      ) : (
        <RunsTable
          runs={rows}
          showApplication={!fixed?.application}
          onOpen={(run) => void navigate({ to: '/runs/$id', params: { id: run.id } })}
          onEndReached={() => {
            if (runs.hasNextPage && !runs.isFetchingNextPage) void runs.fetchNextPage();
          }}
          empty={
            <div className="py-12">
              <EmptyState
                icon={<Icon name="play" size={18} />}
                title={filtered ? t('pipelines.runs.noMatch') : t('pipelines.runs.emptyTitle')}
                description={filtered ? undefined : t('pipelines.runs.emptyDescription')}
                headingLevel={2}
                action={
                  filtered ? (
                    <Button
                      onClick={() => set({ state: undefined, mine: undefined, q: undefined })}
                    >
                      {t('pipelines.catalog.clearFilters')}
                    </Button>
                  ) : undefined
                }
              />
            </div>
          }
        />
      )}
    </div>
  );
}
