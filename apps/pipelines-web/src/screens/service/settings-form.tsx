import { useT } from '@bemmoly/core-web';
import type {
  ApplicationDeploySettings,
  DeploySettingField,
} from '@bemmoly/module-pipelines/shared';
import { Field, FormGrid, Input, Select } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { pipelinesText, servicesText } from '../../i18n/catalog.ts';
import { FIELD_LABEL, isNumberField, type SettingsDraft } from '../application/settings/fields.ts';
import { CARD } from './card.ts';
import { followedValue } from './settings-draft.ts';

function SettingsCard({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className={CARD} aria-label={title}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-14 font-semibold text-tx">{title}</h2>
        {note ? <span className="text-12 text-tx-3">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * The settings of one environment as cards: size, scaling and network up front, the rest
 * under Advanced. An empty field follows application.yaml, then the runtime's default, and
 * shows that value as its placeholder.
 */
export function SettingsForm({
  item,
  draft,
  invalid,
  onChange,
  variables,
}: {
  item: ApplicationDeploySettings;
  draft: SettingsDraft;
  invalid: DeploySettingField | null;
  onChange: (field: DeploySettingField, value: string) => void;
  variables: ReactNode;
}) {
  const t = useT(servicesText);
  const p = useT(pipelinesText);
  const applies = (field: DeploySettingField) =>
    item.effective.find((entry) => entry.field === field)?.applies ?? true;
  const input = (field: DeploySettingField) =>
    applies(field) ? (
      <Field
        key={field}
        label={p(FIELD_LABEL[field])}
        error={invalid === field ? p('pipelines.deploySettings.invalid') : undefined}
      >
        <Input
          value={draft[field]}
          inputMode={isNumberField(field) ? 'numeric' : undefined}
          placeholder={followedValue(item, field)}
          onChange={(event) => onChange(field, event.target.value)}
        />
      </Field>
    ) : null;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SettingsCard
        title={t('pipelinesServices.settings.size')}
        note={t('pipelinesServices.settings.perInstance')}
      >
        <FormGrid columns={3}>
          {input('resources.cpu')}
          {input('resources.memory')}
          {input('scaling.concurrency')}
        </FormGrid>
      </SettingsCard>
      <SettingsCard
        title={t('pipelinesServices.settings.scaling')}
        note={t('pipelinesServices.settings.scalingNote')}
      >
        <FormGrid columns={2}>
          {input('scaling.min')}
          {input('scaling.max')}
        </FormGrid>
      </SettingsCard>
      <SettingsCard title={t('pipelinesServices.settings.network')}>
        <FormGrid columns={2}>
          {input('port')}
          {input('healthcheck.path')}
        </FormGrid>
      </SettingsCard>
      <SettingsCard title={t('pipelinesServices.settings.variables')}>{variables}</SettingsCard>
      <details className={`${CARD} group`}>
        <summary className="flex cursor-pointer items-center gap-2 text-14 font-semibold text-tx focus-ring">
          <Icon name="chevron" size={14} className="transition-transform group-open:rotate-90" />
          {t('pipelinesServices.settings.advanced')}
        </summary>
        <FormGrid columns={2}>
          {input('healthcheck.ready')}
          {input('scaling.cpuTarget')}
          {applies('secretsAs') ? (
            <Field label={p(FIELD_LABEL.secretsAs)}>
              <Select
                value={draft.secretsAs}
                placeholder={followedValue(item, 'secretsAs')}
                options={[
                  { value: '', label: t('pipelinesServices.settings.follow') },
                  { value: 'env', label: p('pipelines.deploySettings.secretsEnv') },
                  { value: 'files', label: p('pipelines.deploySettings.secretsFiles') },
                ]}
                onChange={(event) => onChange('secretsAs', event.value)}
              />
            </Field>
          ) : null}
        </FormGrid>
      </details>
    </div>
  );
}
