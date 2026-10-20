import { HeaderActions, useRecordRecent } from '@bemmoly/core-web';
import {
  Button,
  Dropdown,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  Select,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { workPaths } from '../hooks/issue-navigation.ts';
import { ReportsError, ReportsSkeleton } from '../reports/reports-empty.tsx';
import type { WorkScreenProps } from '../routes.tsx';
import { useProject, useWorkRealtime } from '../shared/index.ts';
import { DashboardGrid } from './dashboard-grid.tsx';
import { DashboardNameDialog, DeleteDashboardDialog } from './dashboard-dialogs.tsx';
import { addableWidgets, widgetLabel } from './registry.ts';
import { useDashboards, type DashboardsState } from './use-dashboards.ts';

/*
 * Dashboards (docs/design/premium/interaction/dashboards.md): a person's own grids of the
 * project's reports. The open dashboard lives in the address; its layout is written to the
 * server on every change.
 */

type Dialog = 'new' | 'rename' | 'delete' | null;

function AddReport({ state }: { state: DashboardsState }) {
  return (
    <Dropdown label="Add report" align="end" widthClassName="w-80">
      {addableWidgets().map((definition) => (
        <MenuItem
          key={definition.type}
          onSelect={() => state.addWidget(definition.type as Parameters<typeof state.addWidget>[0])}
        >
          <span className="flex flex-col">
            <span>{widgetLabel(definition.type)}</span>
            <span className="text-12 font-normal text-tx-3">{definition.description}</span>
          </span>
        </MenuItem>
      ))}
    </Dropdown>
  );
}

export default function DashboardsScreen({ projectKey }: WorkScreenProps) {
  const { project, isPending } = useProject(projectKey);
  const key = project?.key ?? '';
  const state = useDashboards(key);
  const [dialog, setDialog] = useState<Dialog>(null);
  useWorkRealtime(project?.id);
  useRecordRecent(
    project
      ? {
          id: `work.dashboards:${project.key}`,
          title: 'Dashboards',
          context: project.name,
          path: workPaths.dashboards(project.key),
          look: { kind: 'icon', icon: 'pulse', moduleId: 'work' },
          group: 'Reports',
        }
      : null,
  );

  if (isPending || (project && state.list.isPending)) return <ReportsSkeleton />;
  if (!project || state.list.error) {
    const message = state.list.error
      ? `${state.list.error.message.replace(/\.$/, '')}.`
      : 'There is no such project.';
    return <ReportsError message={message} onRetry={() => void state.list.refetch()} />;
  }
  const { dashboard } = state;
  const close = () => setDialog(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-6 py-4 max-md:px-4">
      <h1 className="sr-only">Dashboards</h1>
      <HeaderActions>
        {dashboard && (
          <>
            <Select
              aria-label="Dashboard"
              className="w-56 max-md:w-40"
              value={dashboard.id}
              options={state.dashboards.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(event) => state.select(event.value)}
            />
            <AddReport state={state} />
            <Menu
              align="end"
              trigger={(props) => (
                <IconButton {...props} label="Dashboard actions" icon="more" variant="secondary" />
              )}
            >
              <MenuItem onSelect={() => setDialog('new')}>New dashboard</MenuItem>
              <MenuItem onSelect={() => setDialog('rename')}>Rename</MenuItem>
              <MenuSeparator />
              <MenuItem tone="danger" onSelect={() => setDialog('delete')}>
                Delete dashboard
              </MenuItem>
            </Menu>
          </>
        )}
      </HeaderActions>
      {!dashboard ? (
        <EmptyState
          headingLevel={2}
          icon={<Icon name="pulse" />}
          title="No dashboards yet"
          description="A dashboard puts the reports you check most on one page. It starts with this project's usual reports; add, remove and drag them into the order you want."
          action={
            <Button
              variant="primary"
              loading={state.creating}
              onClick={() => state.create('My dashboard')}
            >
              Create dashboard
            </Button>
          }
        />
      ) : dashboard.widgets.length === 0 ? (
        <EmptyState
          headingLevel={2}
          icon={<Icon name="pulse" />}
          title={`${dashboard.name} is empty`}
          description="Add a report from Add report above. Burndown, velocity, flow and the quarter are all there."
        />
      ) : (
        <DashboardGrid
          projectKey={key}
          widgets={dashboard.widgets}
          onMove={state.move}
          onResize={state.resize}
          onRemove={state.removeWidget}
        />
      )}
      {dialog === 'new' && (
        <DashboardNameDialog
          open
          title="New dashboard"
          action="Create dashboard"
          initial=""
          onSave={state.create}
          onClose={close}
        />
      )}
      {dialog === 'rename' && dashboard && (
        <DashboardNameDialog
          open
          title="Rename dashboard"
          action="Rename"
          initial={dashboard.name}
          onSave={state.rename}
          onClose={close}
        />
      )}
      {dialog === 'delete' && dashboard && (
        <DeleteDashboardDialog open name={dashboard.name} onDelete={state.remove} onClose={close} />
      )}
    </div>
  );
}
