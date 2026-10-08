import type { AdminModule } from '@bemmoly/shared';
import { Badge, Button, EmptyState, Table, type BadgeTone, type TableColumn } from '@bemmoly/ui';
import { moduleName } from '../../hooks/use-admin-modules.ts';

const CHANGELOG: Record<AdminModule['changelogState'], { label: string; tone: BadgeTone }> = {
  current: { label: 'CURRENT', tone: 'ok' },
  pending: { label: 'PENDING', tone: 'amber' },
  failed: { label: 'FAILED', tone: 'warn' },
  removed: { label: 'DATA REMOVED', tone: 'neutral' },
};

interface ModulesTableProps {
  modules: readonly AdminModule[];
  pinned: boolean;
  /** The module whose enable or disable is in flight. */
  busyId: string | null;
  onEnable: (id: string) => void;
  onDisable: (id: string) => void;
  onRemoveData: (id: string) => void;
}

export function ModulesTable({
  modules,
  pinned,
  busyId,
  onEnable,
  onDisable,
  onRemoveData,
}: ModulesTableProps) {
  const columns: TableColumn<AdminModule>[] = [
    {
      key: 'module',
      header: 'Module',
      width: 'minmax(0,1.5fr)',
      render: (module) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">{module.name}</span>
          <span className="truncate text-12 text-tx5">
            {module.dependsOn.length
              ? `Depends on ${module.dependsOn.map(moduleName).join(', ')}`
              : 'No dependencies'}
          </span>
          {module.restartRequired ? (
            <span className="text-12 text-amber-fg">Restart required to finish the change</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'state',
      header: 'State',
      width: '100px',
      render: (module) =>
        module.enabled ? <Badge tone="ok">ENABLED</Badge> : <Badge>DISABLED</Badge>,
    },
    {
      key: 'version',
      header: 'Version',
      width: '120px',
      render: (module) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-12">{module.version}</span>
          {module.versionInstalled !== module.version ? (
            <span className="text-12 text-tx5">
              {module.versionInstalled ? `${module.versionInstalled} installed` : 'Not installed'}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'changelog',
      header: 'Changelog',
      width: 'minmax(0,1fr)',
      render: (module) => (
        <div className="flex flex-col items-start gap-0.5">
          <Badge tone={CHANGELOG[module.changelogState].tone}>
            {CHANGELOG[module.changelogState].label}
          </Badge>
          {module.pendingChangesets > 0 ? (
            <span className="text-12 text-tx5">
              {module.pendingChangesets} changeset{module.pendingChangesets === 1 ? '' : 's'}{' '}
              pending
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      width: '190px',
      align: 'end',
      render: (module) =>
        pinned ? (
          <span className="text-12 text-tx5">Set by BEMMOLY_MODULES</span>
        ) : (
          <div className="flex items-center gap-1.5">
            {!module.enabled && module.changelogState !== 'removed' ? (
              <Button size="xs" variant="ghost" onClick={() => onRemoveData(module.id)}>
                Remove data
              </Button>
            ) : null}
            {module.enabled ? (
              <Button
                size="xs"
                aria-label={`Disable ${module.name}`}
                onClick={() => onDisable(module.id)}
              >
                Disable
              </Button>
            ) : (
              <Button
                size="xs"
                variant="primary"
                aria-label={`Enable ${module.name}`}
                loading={busyId === module.id}
                onClick={() => onEnable(module.id)}
              >
                Enable
              </Button>
            )}
          </div>
        ),
    },
  ];
  return (
    <Table
      label="Modules"
      columns={columns}
      rows={modules}
      rowKey={(module) => module.id}
      empty={
        <EmptyState
          title="No modules in this image"
          description="The kernel runs on its own. Modules ship inside the image, so a newer release adds them."
        />
      }
    />
  );
}
