import { useT } from '@bemmoly/core-web';
import type { ApplicationDeploySettings } from '@bemmoly/module-pipelines/shared';
import { Badge, Button, ConfirmChange, Table, type TableColumn } from '@bemmoly/ui';
import { useState } from 'react';
import { useDeploySettings, useDeploySettingsWrites } from '../../../hooks/use-deploy-settings.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { LoadError } from '../../../parts/load-error.tsx';
import { RowsSkeleton } from '../../../parts/rows-skeleton.tsx';
import { RUNTIME_NAME } from '../../../parts/runtime-words.ts';
import { SIDE_CARD } from '../side-cards.tsx';
import { FIELD_LABEL, SOURCE_LABEL } from './fields.ts';
import { SettingsDialog } from './settings-dialog.tsx';

type Entry = ApplicationDeploySettings['effective'][number];

/** One environment: its runtime, every setting's value and where it came from, edit and clear. */
function EnvironmentSettings({
  item,
  onEdit,
  onClear,
}: {
  item: ApplicationDeploySettings;
  onEdit: () => void;
  onClear: () => void;
}) {
  const t = useT(pipelinesText);
  const set = Object.keys(item.settings).length > 0;
  const columns: TableColumn<Entry>[] = [
    {
      key: 'field',
      header: t('pipelines.deploySettings.setting'),
      width: 'minmax(0,1fr)',
      render: (entry) => <span className="truncate text-tx">{t(FIELD_LABEL[entry.field])}</span>,
    },
    {
      key: 'value',
      header: t('pipelines.deploySettings.value'),
      width: 'minmax(0,1fr)',
      render: (entry) =>
        entry.applies && entry.value === null ? (
          <span className="truncate text-12 text-tx-3">
            {t('pipelines.deploySettings.runtimeDecides')}
          </span>
        ) : entry.applies && entry.field === 'secretsAs' ? (
          <span className="truncate text-12 text-tx">
            {entry.value === 'files'
              ? t('pipelines.deploySettings.secretsFiles')
              : t('pipelines.deploySettings.secretsEnv')}
          </span>
        ) : entry.applies ? (
          <span className="truncate font-mono text-12 text-tx">{entry.value}</span>
        ) : (
          <span className="truncate text-12 text-tx-3">
            {t('pipelines.deploySettings.notHere', { runtime: t(RUNTIME_NAME[item.runtime]) })}
          </span>
        ),
    },
    {
      key: 'source',
      header: t('pipelines.deploySettings.from'),
      width: 'minmax(0,1fr)',
      render: (entry) =>
        entry.applies ? (
          <Badge tone={entry.source === 'pipelines' ? 'accent' : 'neutral'}>
            {t(SOURCE_LABEL[entry.source], { environment: item.environment.key })}
          </Badge>
        ) : null,
    },
  ];
  return (
    <section className={SIDE_CARD} aria-labelledby={`settings-${item.environment.key}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id={`settings-${item.environment.key}`}
          className="text-16 leading-title font-semibold text-tx"
        >
          {item.environment.name}
        </h2>
        <Badge>{t(RUNTIME_NAME[item.runtime])}</Badge>
        {item.disruptionBudget && (
          <span className="text-12 text-tx-3">{t('pipelines.deploySettings.budget')}</span>
        )}
        <span className="ms-auto flex gap-2">
          {set && (
            <Button size="sm" variant="ghost" onClick={onClear}>
              {t('pipelines.deploySettings.clear')}
            </Button>
          )}
          <Button size="sm" onClick={onEdit}>
            {t('pipelines.deploySettings.edit')}
          </Button>
        </span>
      </div>
      {item.problem && <p className="text-12 leading-body text-amber-tx">{item.problem}</p>}
      <Table
        label={t('pipelines.deploySettings.tableLabel', { environment: item.environment.name })}
        columns={columns}
        rows={item.effective}
        rowKey={(entry) => entry.field}
        empty={null}
      />
      <p className="text-12 text-tx-3">
        {item.release
          ? t('pipelines.deploySettings.fromRelease', { version: item.release.version })
          : t('pipelines.deploySettings.noRelease')}
      </p>
    </section>
  );
}

/**
 * The Settings tab: how the application runs in each environment, apart from where. Each value
 * says whether it was set here, in application.yaml, or is the runtime's default. A change
 * takes effect on the next deploy.
 */
export function SettingsTab({ application }: { application: string }) {
  const t = useT(pipelinesText);
  const settings = useDeploySettings(application);
  const { clear } = useDeploySettingsWrites(application);
  const [editing, setEditing] = useState<string | null>(null);
  const [clearing, setClearing] = useState<ApplicationDeploySettings | null>(null);
  if (settings.isError) {
    return (
      <LoadError
        title={t('pipelines.deploySettings.loadFailed')}
        error={settings.error}
        onRetry={() => void settings.refetch()}
      />
    );
  }
  if (!settings.data) return <RowsSkeleton rows={6} />;
  const edited = settings.data.items.find((item) => item.environment.key === editing);
  const close = () => {
    clear.reset();
    setClearing(null);
  };
  return (
    <section className="flex flex-col gap-4" aria-label={t('pipelines.deploySettings.title')}>
      <p className="text-13 text-tx-2">{t('pipelines.deploySettings.intro')}</p>
      {settings.data.items.map((item) => (
        <EnvironmentSettings
          key={item.environment.id}
          item={item}
          onEdit={() => setEditing(item.environment.key)}
          onClear={() => setClearing(item)}
        />
      ))}
      {edited && (
        <SettingsDialog application={application} item={edited} onClose={() => setEditing(null)} />
      )}
      <ConfirmChange
        open={clearing !== null}
        title={t('pipelines.deploySettings.clearTitle', {
          environment: clearing?.environment.name ?? '',
        })}
        consequences={[t('pipelines.deploySettings.clearFollows')]}
        confirmLabel={t('pipelines.deploySettings.clear')}
        tone="caution"
        busy={clear.isPending}
        error={<ActionError error={clear.error} />}
        onCancel={close}
        onConfirm={() => clearing && clear.mutate(clearing.environment.key, { onSuccess: close })}
      />
    </section>
  );
}
