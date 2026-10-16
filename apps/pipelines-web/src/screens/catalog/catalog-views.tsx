import { formatNumber, usePreference, useT } from '@bemmoly/core-web';
import { Button, Menu, MenuItem, SegmentedControl } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { pipelinesText } from '../../i18n/catalog.ts';
import {
  applyView,
  catalogQuery,
  EMPTY_FACETS,
  sameFilters,
  type CatalogState,
  type ViewFilters,
} from './catalog-search.ts';
import { SaveViewDialog } from './save-view-dialog.tsx';
import { useCount } from './use-catalog.ts';

export interface SavedView {
  id: string;
  name: string;
  filters: ViewFilters;
}

type BuiltIn = 'all' | 'mine' | 'tier0' | 'stale' | 'noOwner';

/** The lists people come back to, including the uncomfortable ones (product design, Catalog). */
const BUILT_IN: Record<BuiltIn, ViewFilters> = {
  all: {},
  mine: { mine: true },
  tier0: { facets: { tier: ['0'] } },
  stale: { staleDays: 90 },
  noOwner: { facets: { team: ['none'] } },
};

const BASE: CatalogState = {
  q: '',
  facets: EMPTY_FACETS,
  mine: false,
  staleDays: null,
  sort: 'name',
};

function useViewCount(view: ViewFilters, scope: { domain: string | null; group: string | null }) {
  return useCount(catalogQuery(applyView(BASE, view), scope)).data;
}

/**
 * All · 212, My teams · 23, Tier 0 · 9, Not deployed in 90 days · 14, No owner · 2, then the
 * person's own views. Filters that match no view show as "Filtered", which Save view keeps.
 */
export function CatalogViews({
  state,
  scope,
  matching,
  onApply,
  saveOpen,
  onSaveOpenChange,
}: {
  state: CatalogState;
  scope: { domain: string | null; group: string | null };
  matching: number | undefined;
  onApply: (filters: ViewFilters) => void;
  saveOpen: boolean;
  onSaveOpenChange: (open: boolean) => void;
}) {
  const t = useT(pipelinesText);
  const [saved, setSaved] = usePreference<SavedView[]>('pipelines.catalog.views', []);
  const counts: Record<BuiltIn, number | undefined> = {
    all: useViewCount(BUILT_IN.all, scope),
    mine: useViewCount(BUILT_IN.mine, scope),
    tier0: useViewCount(BUILT_IN.tier0, scope),
    stale: useViewCount(BUILT_IN.stale, scope),
    noOwner: useViewCount(BUILT_IN.noOwner, scope),
  };
  const [pending, setPending] = useState(false);
  const label = (name: string, count: number | undefined) =>
    count === undefined
      ? name
      : t('pipelines.catalog.viewCount', { name, count: formatNumber(count) });
  const builtIn = (Object.keys(BUILT_IN) as BuiltIn[]).map((id) => ({
    value: id as string,
    label: label(t(`pipelines.catalog.view.${id}`), counts[id]),
  }));
  const own = saved.map((view) => ({ value: view.id, label: view.name }));
  const current =
    (Object.keys(BUILT_IN) as BuiltIn[]).find((id) => sameFilters(state, BUILT_IN[id])) ??
    saved.find((view) => sameFilters(state, view.filters))?.id ??
    'filtered';
  const options = [
    ...builtIn,
    ...own,
    ...(current === 'filtered'
      ? [{ value: 'filtered', label: label(t('pipelines.catalog.view.filtered'), matching) }]
      : []),
  ];
  const choose = (id: string) => {
    const view = BUILT_IN[id as BuiltIn] ?? saved.find((item) => item.id === id)?.filters;
    if (view) onApply(view);
  };
  const ownCurrent = saved.find((view) => view.id === current);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="min-w-0 overflow-x-auto">
        <SegmentedControl
          size="sm"
          aria-label={t('pipelines.catalog.views')}
          options={options}
          value={current}
          onChange={choose}
          className="w-max"
        />
      </div>
      <div className="ms-auto flex shrink-0 items-center gap-1">
        {ownCurrent ? (
          <Menu
            align="end"
            trigger={(props) => (
              <Button
                {...props}
                size="sm"
                variant="ghost"
                aria-label={t('pipelines.catalog.viewMenu')}
              >
                <Icon name="more" size={14} />
              </Button>
            )}
          >
            <MenuItem
              tone="danger"
              onSelect={() => {
                setSaved(saved.filter((view) => view.id !== ownCurrent.id));
                onApply({});
              }}
            >
              {t('pipelines.catalog.viewDelete', { name: ownCurrent.name })}
            </MenuItem>
          </Menu>
        ) : null}
        {current === 'filtered' ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onSaveOpenChange(true)}
            loading={pending}
          >
            <Icon name="plus" size={14} />
            {t('pipelines.catalog.saveView')}
          </Button>
        ) : null}
      </div>
      <SaveViewDialog
        open={saveOpen && current === 'filtered'}
        onClose={() => onSaveOpenChange(false)}
        onSave={(name) => {
          setPending(true);
          const view: SavedView = {
            id: `view-${Date.now().toString(36)}`,
            name,
            filters: {
              ...(state.q ? { q: state.q } : {}),
              facets: state.facets,
              ...(state.mine ? { mine: true } : {}),
              ...(state.staleDays ? { staleDays: state.staleDays } : {}),
            },
          };
          setSaved([...saved, view]);
          setPending(false);
          onSaveOpenChange(false);
        }}
      />
    </div>
  );
}
