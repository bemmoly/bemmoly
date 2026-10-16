import { formatNumber, useScreenActions, useT } from '@bemmoly/core-web';
import { Button, EmptyState, Kbd, Modal, SearchInput, usePhoneWidth } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useDraft } from '../../hooks/use-draft.ts';
import { useScreenKeys } from '../../hooks/use-screen-keys.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { ScreenFrame } from '../screen-frame.tsx';
import { CatalogFacets } from './catalog-facets.tsx';
import { applyView, catalogQuery, EMPTY_FACETS } from './catalog-search.ts';
import { CatalogTable, CatalogTableSkeleton } from './catalog-table.tsx';
import { CatalogViews } from './catalog-views.tsx';
import { useApplicationsList, useCatalogState, useFacets } from './use-catalog.ts';

/**
 * All 1,140 applications, facetted by every axis, with delivery health in each row. The
 * address holds every filter; the list is keyset pages drawn as a virtual table on the
 * frame's own scroll, so the thousandth row costs what the tenth does.
 */
export default function CatalogScreen() {
  const t = useT(pipelinesText);
  const navigate = useNavigate();
  const phone = usePhoneWidth();
  const { state, scope, commit, toggle, domains } = useCatalogState();
  const query = catalogQuery(state, scope);
  const list = useApplicationsList(query);
  const facets = useFacets(query);
  const [text, setText] = useDraft(state.q, (q) => commit({ ...state, q }, undefined, true));
  const [saveOpen, setSaveOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const facetPanel = useRef<HTMLDivElement>(null);

  const pages = list.data?.pages ?? [];
  const rows = pages.flatMap((page) => page.items);
  const total = pages[0]?.total ?? 0;
  const all = pages[0]?.all ?? 0;
  const filtered =
    state.q || Object.values(state.facets).some((v) => v.length) || state.mine || state.staleDays;
  const clear = () =>
    commit({ ...state, q: '', facets: EMPTY_FACETS, mine: false, staleDays: null });
  const focusFacets = () => {
    if (phone) setFiltersOpen(true);
    else facetPanel.current?.querySelector<HTMLInputElement>('input')?.focus();
  };
  const firstRow = () =>
    document
      .querySelector<HTMLElement>('[aria-label] [role="rowgroup"] [role="row"][tabindex]')
      ?.focus();

  useScreenKeys({
    '/': () => search.current?.focus(),
    f: focusFacets,
    s: () => setSaveOpen(true),
    j: firstRow,
  });
  useScreenActions([
    {
      id: 'catalog.search',
      title: t('pipelines.catalog.actionSearch'),
      keys: '/',
      run: () => search.current?.focus(),
    },
    {
      id: 'catalog.facets',
      title: t('pipelines.catalog.actionFilters'),
      keys: 'F',
      run: focusFacets,
    },
    {
      id: 'catalog.save',
      title: t('pipelines.catalog.saveView'),
      keys: 'S',
      run: () => setSaveOpen(true),
    },
    ...(filtered
      ? [{ id: 'catalog.clear', title: t('pipelines.catalog.clearFilters'), run: clear }]
      : []),
  ]);

  const facetsPanel = (
    <CatalogFacets facets={facets.data} state={state} domains={domains} onToggle={toggle} />
  );
  const empty = list.isError ? null : (
    <div className="py-12">
      {all === 0 && !filtered ? (
        <EmptyState
          icon={<Icon name="grid" size={18} />}
          title={t('pipelines.catalog.emptyTitle')}
          description={t('pipelines.catalog.emptyDescription')}
          headingLevel={2}
        />
      ) : (
        <EmptyState
          icon={<Icon name="filter" size={18} />}
          title={t('pipelines.catalog.noMatchTitle')}
          description={t('pipelines.catalog.noMatchDescription')}
          headingLevel={2}
          action={<Button onClick={clear}>{t('pipelines.catalog.clearFilters')}</Button>}
        />
      )}
    </div>
  );

  return (
    <ScreenFrame
      title={t('pipelines.catalog.title')}
      meta={
        list.data
          ? t('pipelines.catalog.count', { shown: formatNumber(total), all: formatNumber(all) })
          : null
      }
      actions={
        <>
          <SearchInput
            ref={search}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') search.current?.blur();
              if (event.key === 'Enter' || event.key === 'ArrowDown') {
                event.preventDefault();
                firstRow();
              }
            }}
            placeholder={t('pipelines.catalog.searchPlaceholder')}
            aria-label={t('pipelines.catalog.searchPlaceholder')}
            hint="/"
            className="w-full sm:w-64"
          />
          <Button className="md:hidden" onClick={() => setFiltersOpen(true)}>
            <Icon name="filter" size={14} />
            {t('pipelines.catalog.filters')}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[210px_minmax(0,1fr)]">
        <aside ref={facetPanel} className="hidden md:block">
          <div className="sticky top-5">{facetsPanel}</div>
        </aside>
        <div className="flex min-w-0 flex-col gap-3">
          <CatalogViews
            state={state}
            scope={scope}
            matching={list.data ? total : undefined}
            onApply={(view) => commit(applyView(state, view))}
            saveOpen={saveOpen}
            onSaveOpenChange={setSaveOpen}
          />
          {list.isError ? (
            <div className="rounded-card border border-line bg-card py-12 shadow-e1">
              <EmptyState
                icon={<Icon name="warning" size={18} />}
                title={t('pipelines.catalog.errorTitle')}
                description={t('pipelines.common.loadFailed')}
                headingLevel={2}
                action={
                  <Button onClick={() => void list.refetch()}>
                    {t('pipelines.common.tryAgain')}
                  </Button>
                }
              />
            </div>
          ) : list.isPending ? (
            <CatalogTableSkeleton />
          ) : (
            <CatalogTable
              rows={rows}
              total={total}
              sort={state.sort}
              onSort={(sort) => commit({ ...state, sort })}
              onOpen={(app) =>
                void navigate({
                  to: '/applications/$key',
                  params: { key: app.key },
                  search: { scope: `${app.domain.key}/${app.group.key}` },
                })
              }
              onEndReached={() => {
                if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
              }}
              loadingMore={list.isFetchingNextPage}
              empty={empty}
            />
          )}
          <p className="hidden text-12 text-tx-3 md:block">
            {t('pipelines.catalog.keysHint')} <Kbd keys="J K" variant="plain" />{' '}
            <Kbd keys="Enter" variant="plain" />
          </p>
        </div>
      </div>
      <Modal
        open={filtersOpen && phone}
        onClose={() => setFiltersOpen(false)}
        title={t('pipelines.catalog.filters')}
        footer={
          <Button variant="primary" onClick={() => setFiltersOpen(false)}>
            {t('pipelines.catalog.showResults', { count: total })}
          </Button>
        }
      >
        {facetsPanel}
      </Modal>
    </ScreenFrame>
  );
}
