import { useT } from '@bemmoly/core-web';
import type { ReachableProject } from '@bemmoly/module-pipelines/shared';
import { Badge, Table, type TableColumn } from '@bemmoly/ui';
import { setupText } from '../../../i18n/catalog.ts';

function OnOff({ on }: { on: boolean }) {
  const t = useT(setupText);
  return (
    <Badge tone={on ? 'ok' : 'warn'}>
      {on ? t('pipelinesSetup.cloud.on') : t('pipelinesSetup.cloud.off')}
    </Badge>
  );
}

/** The projects Check found, and what each one is missing. */
export function ProjectsTable({ projects }: { projects: ReachableProject[] }) {
  const t = useT(setupText);
  const service = (key: keyof ReachableProject['services'], header: string) => ({
    key,
    header,
    width: '110px',
    render: (row: ReachableProject) => <OnOff on={row.services[key]} />,
  });
  const columns: TableColumn<ReachableProject>[] = [
    {
      key: 'project',
      header: t('pipelinesSetup.cloud.colProject'),
      width: 'minmax(0,2fr)',
      render: (row) => (
        <span className="flex flex-col">
          <span className="font-mono text-12">{row.externalId}</span>
          {row.problems.length > 0 && (
            <span className="text-12 text-amber-tx">{row.problems.join(' ')}</span>
          )}
        </span>
      ),
    },
    service('run', t('pipelinesSetup.cloud.colRun')),
    service('build', t('pipelinesSetup.cloud.colBuild')),
    service('secrets', t('pipelinesSetup.cloud.colSecrets')),
  ];
  return (
    <Table
      label={t('pipelinesSetup.cloud.projectsLabel')}
      columns={columns}
      rows={projects}
      rowKey={(row) => row.externalId}
      density="sm"
    />
  );
}
