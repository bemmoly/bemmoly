import {
  newWidget,
  type Dashboard,
  type DashboardWidget,
  type WidgetSize,
  type WidgetType,
} from '@bemmoly/module-work/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, workKeys } from '../shared/index.ts';
import { setSearchParams, useSearchParam } from '../shared/url-state.ts';

/*
 * The Dashboards screen's state: the caller's dashboards on the project, the one in the
 * address, and the layout writes. A layout change shows at once and is written whole; a
 * refused write puts the server's copy back and says so.
 */

const move = <T>(list: readonly T[], from: number, to: number): T[] => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
};

export function useDashboards(projectKey: string) {
  const client = useQueryClient();
  const toast = useToast();
  const key = workKeys.dashboards(projectKey);
  const list = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.work.dashboards.list(projectKey, { signal }),
    enabled: Boolean(projectKey),
  });
  const param = useSearchParam('dashboard');
  const dashboards = list.data ?? [];
  const dashboard = dashboards.find((item) => item.id === param) ?? dashboards[0];
  const select = (id: string | null) =>
    setSearchParams({ dashboard: id && id !== dashboards[0]?.id ? id : null });

  const replace = (next: Dashboard) =>
    client.setQueryData<Dashboard[]>(key, (current = []) =>
      current.map((item) => (item.id === next.id ? next : item)),
    );

  const saveKey = [...key, 'save'];
  const save = useMutation({
    mutationKey: saveKey,
    /** One write at a time, in order, so the last layout is the one that stays. */
    scope: { id: saveKey.join('/') },
    mutationFn: (next: Dashboard) =>
      api.work.dashboards.update(next.id, { name: next.name, widgets: next.widgets }),
    onMutate: (next) => {
      const previous = client.getQueryData<Dashboard[]>(key);
      replace(next);
      return { previous };
    },
    onError: (_error, _next, context) => {
      client.setQueryData(key, context?.previous);
      toast.show({ tone: 'warn', title: 'The dashboard was not saved. Try again.' });
    },
    onSuccess: (saved) => {
      if (client.isMutating({ mutationKey: saveKey }) <= 1) replace(saved);
    },
  });

  const create = useMutation({
    mutationFn: (name: string) => api.work.dashboards.create({ name, projectId: projectKey }),
    onSuccess: (created) => {
      client.setQueryData<Dashboard[]>(key, (current = []) => [...current, created]);
      setSearchParams({ dashboard: dashboards.length === 0 ? null : created.id });
    },
    onError: () => toast.show({ tone: 'warn', title: 'The dashboard was not created. Try again.' }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.work.dashboards.remove(id),
    onSuccess: (_result, id) => {
      client.setQueryData<Dashboard[]>(key, (current = []) =>
        current.filter((item) => item.id !== id),
      );
      setSearchParams({ dashboard: null });
    },
    onError: () => toast.show({ tone: 'warn', title: 'The dashboard was not deleted. Try again.' }),
  });

  const layout = (widgets: DashboardWidget[]) => {
    if (dashboard) save.mutate({ ...dashboard, widgets });
  };
  const widgets = dashboard?.widgets ?? [];

  return {
    list,
    dashboards,
    dashboard,
    select,
    create: (name: string) => create.mutate(name),
    creating: create.isPending,
    rename: (name: string) => dashboard && save.mutate({ ...dashboard, name }),
    remove: () => dashboard && remove.mutate(dashboard.id),
    move: (from: number, to: number) => layout(move(widgets, from, to)),
    resize: (id: string, size: WidgetSize) =>
      layout(widgets.map((widget) => (widget.id === id ? { ...widget, size } : widget))),
    removeWidget: (id: string) => layout(widgets.filter((widget) => widget.id !== id)),
    /** A new widget gets its id from the client so it can be moved before the write returns. */
    addWidget: (type: Exclude<WidgetType, 'pinned'>) =>
      layout([...widgets, { ...newWidget(type), id: crypto.randomUUID() } as DashboardWidget]),
  };
}

export type DashboardsState = ReturnType<typeof useDashboards>;
