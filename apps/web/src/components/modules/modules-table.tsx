import { ModuleTile } from '@bemmoly/core-web';
import type { AdminModule, ModuleManifest } from '@bemmoly/shared';
import { Button, EmptyState, Table, type TableColumn } from '@bemmoly/ui';
import { moduleName } from '../../hooks/use-admin-modules.ts';
import { StatePill, type PillTone } from '../settings/state-pill.tsx';

const CHANGELOG: Record<AdminModule['changelogState'], { label: string; tone: PillTone }> = {
  current: { label: 'Up to date', tone: 'ok' },
  pending: { label: 'Pending', tone: 'warn' },
  failed: { label: 'Failed', tone: 'red' },
  removed: { label: 'Data removed', tone: 'neutral' },
};

interface ModulesTableProps {
  modules: readonly AdminModule[];
  pinned: boolean;
  /** The module whose enable or disable is in flight. */
  busyId: string | null;
  onEnable: (id: string) => void;
  onDisable: (id: string) => void;
  onRemoveData: (id: string) => void;
  /** Enabled modules' manifests, for their tile's icon and colour. */
  manifests?: readonly ModuleManifest[];
}

export function ModulesTable({
  modules,
  pinned,
  busyId,
  onEnable,
  onDisable,
  onRemoveData,
  manifests = [],
}: ModulesTableProps) {
  const columns: TableColumn<AdminModule>[] = [
    {
      key: 'module',
      header: 'Module',
      width: 'minmax(0,1.5fr)',
      render: (module) => (
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex">
            <ModuleTile
              manifest={
                manifests.find((entry) => entry.id === module.id) ?? {
                  id: module.id,
                  name: module.name,
                }
              }
              size={26}
            />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">{module.name}</span>
            <span className="truncate text-12 text-tx-3">
              {module.dependsOn.length
                ? `Depends on ${module.dependsOn.map(moduleName).join(', ')}`
                : 'No dependencies'}
            </span>
            {module.restartRequired ? (
              <span className="text-12 text-amber-tx">Restart required to finish the change</span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'state',
      header: 'State',
      width: '100px',
      render: (module) =>
        module.enabled ? (
          <StatePill tone="ok" stage="done">
            Enabled
          </StatePill>
        ) : (
          <StatePill tone="neutral" stage="todo">
            Disabled
          </StatePill>
        ),
    },
    {
      key: 'version',
      header: 'Version',
      width: '120px',
      render: (module) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-12">{module.version}</span>
          {module.versionInstalled !== module.version ? (
            <span className="text-12 text-tx-3">
              {module.versionInstalled ? `${module.versionInstalled} installed` : 'Not installed'}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'changelog',
      header: 'Schema',
      width: 'minmax(0,1fr)',
      render: (module) => (
        <div className="flex flex-col items-start gap-0.5">
          <StatePill tone={CHANGELOG[module.changelogState].tone}>
            {CHANGELOG[module.changelogState].label}
          </StatePill>
          {module.pendingChangesets > 0 ? (
            <span className="text-12 text-tx-3">
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
          <span className="text-12 text-tx-3">Set by BEMMOLY_MODULES</span>
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
