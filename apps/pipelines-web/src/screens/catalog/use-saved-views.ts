import type { SavedView } from '@bemmoly/module-pipelines/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deliveryKeys } from '../../api/delivery.ts';
import { api } from '../../lib/api.ts';
import {
  readCatalog,
  writeCatalog,
  type CatalogState,
  type ViewFilters,
} from './catalog-search.ts';

/** A saved view's address as the filters it holds. */
export function filtersOf(view: SavedView): ViewFilters {
  const state = readCatalog(view.query);
  return {
    ...(state.q ? { q: state.q } : {}),
    facets: state.facets,
    ...(state.mine ? { mine: true } : {}),
    ...(state.staleDays ? { staleDays: state.staleDays } : {}),
  };
}

/**
 * The person's own catalog views, kept on the server so they follow them to any device.
 * Deleting is undoable: the view comes back with the same name and filters.
 */
export function useSavedViews() {
  const client = useQueryClient();
  const toast = useToast();
  const key = deliveryKeys.views('catalog');
  const views = useQuery({ queryKey: key, queryFn: () => api.delivery.views('catalog') });
  const refresh = () => void client.invalidateQueries({ queryKey: key });
  const save = useMutation({
    mutationFn: ({ name, state }: { name: string; state: CatalogState }) => {
      // A view keeps the filters, not where it was saved or how it was sorted.
      const query = writeCatalog({ ...state, sort: 'name' }, undefined) as Record<string, string>;
      return api.delivery.createView({ name, screen: 'catalog', query });
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (view: SavedView) => api.delivery.deleteView(view.id),
    onSuccess: (_, view) => {
      refresh();
      toast.undo({
        title: view.name,
        onUndo: () =>
          void api.delivery
            .createView({ name: view.name, screen: 'catalog', query: view.query })
            .then(refresh),
      });
    },
  });
  return { views: views.data?.items ?? [], save, remove };
}
