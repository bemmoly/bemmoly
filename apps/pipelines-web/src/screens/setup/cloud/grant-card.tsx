import { useT } from '@bemmoly/core-web';
import type { ReachableProject } from '@bemmoly/module-pipelines/shared';
import { Badge, Button, Card, CardBody, CardHeader, Table, type TableColumn } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { setupText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { CommandBlock } from './command-block.tsx';
import type { ConnectCloud } from './use-connect-cloud.ts';

const CLOUD_SHELL = 'https://shell.cloud.google.com/?show=terminal';

function OnOff({ on }: { on: boolean }) {
  const t = useT(setupText);
  return (
    <Badge tone={on ? 'ok' : 'warn'}>
      {on ? t('pipelinesSetup.cloud.on') : t('pipelinesSetup.cloud.off')}
    </Badge>
  );
}

/** Grant access: the command for the person's choices, Check access, what it found, Connect. */
export function GrantCard({ flow }: { flow: ConnectCloud }) {
  const t = useT(setupText);
  if (!flow.ready || !flow.command) {
    return (
      <div
        role="note"
        className="flex items-start gap-2 rounded-control bg-acc-50 px-3 py-2.5 text-13 text-tx"
      >
        <Icon name="info" size={16} className="mt-0.5 shrink-0 text-acc" />
        <span>{t('pipelinesSetup.cloud.choose')}</span>
      </div>
    );
  }
  const checked = flow.checked;
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
    {
      key: 'run',
      header: t('pipelinesSetup.cloud.colRun'),
      width: '110px',
      render: (row) => <OnOff on={row.services.run} />,
    },
    {
      key: 'build',
      header: t('pipelinesSetup.cloud.colBuild'),
      width: '110px',
      render: (row) => <OnOff on={row.services.build} />,
    },
    {
      key: 'secrets',
      header: t('pipelinesSetup.cloud.colSecrets'),
      width: '110px',
      render: (row) => <OnOff on={row.services.secrets} />,
    },
  ];
  const blocked = checked?.projects.filter((project) => !project.ok).length ?? 0;
  return (
    <Card>
      <CardHeader
        title={<h2 className="text-15 font-semibold">{t('pipelinesSetup.cloud.grantTitle')}</h2>}
        hint={t('pipelinesSetup.cloud.grantHint')}
      />
      <CardBody className="flex flex-col gap-3">
        <span className="text-12 text-tx-3">
          {flow.principal
            ? t('pipelinesSetup.cloud.principal', { principal: flow.principal })
            : t('pipelinesSetup.cloud.principalUnknown')}
        </span>
        <CommandBlock
          label={t('pipelinesSetup.cloud.grantLabel')}
          command={flow.command}
          actions={
            <>
              <a
                href={CLOUD_SHELL}
                target="_blank"
                rel="noreferrer"
                className="text-13 font-medium text-acc"
              >
                {t('pipelinesSetup.cloud.cloudShell')}
              </a>
              <span className="flex-1" />
              <Button
                size="sm"
                variant={checked ? 'secondary' : 'primary'}
                icon={<Icon name="refresh" size={14} />}
                loading={flow.checking}
                onClick={flow.check}
              >
                {checked ? t('pipelinesSetup.cloud.checkAgain') : t('pipelinesSetup.cloud.check')}
              </Button>
            </>
          }
        />
        <ActionError error={flow.checkError} />
        {checked && !checked.signedIn && (
          <div
            role="status"
            className="rounded-control bg-amber-50 px-3 py-2 text-12 text-amber-tx"
          >
            <b className="block font-semibold">{t('pipelinesSetup.cloud.signInFailed')}</b>
            {checked.problems.join(' ')}
          </div>
        )}
        {checked?.signedIn && checked.projects.length === 0 && (
          <span role="status" className="text-13 text-amber-tx">
            {t('pipelinesSetup.cloud.noProjects')}
          </span>
        )}
        {checked?.signedIn && checked.projects.length > 0 && (
          <>
            <Table
              label={t('pipelinesSetup.cloud.projectsLabel')}
              columns={columns}
              rows={checked.projects}
              rowKey={(row) => row.externalId}
              density="sm"
            />
            {blocked > 0 && (
              <span className="text-12 text-amber-tx">
                {t('pipelinesSetup.cloud.someBlocked', { count: blocked })}
              </span>
            )}
            <ActionError error={flow.connectError} />
            <div className="flex justify-end">
              <Button variant="primary" loading={flow.connecting} onClick={flow.connect}>
                {t('pipelinesSetup.cloud.connect')}
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
