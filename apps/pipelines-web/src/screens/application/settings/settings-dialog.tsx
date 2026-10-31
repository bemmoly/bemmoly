import { useT } from '@bemmoly/core-web';
import {
  DEPLOY_SETTING_FIELDS,
  type ApplicationDeploySettings,
  type DeploySettingField,
} from '@bemmoly/module-pipelines/shared';
import { Button, Field, Input, Modal, Select } from '@bemmoly/ui';
import { useState, type KeyboardEvent } from 'react';
import { useDeploySettingsWrites } from '../../../hooks/use-deploy-settings.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { RUNTIME_NAME } from '../../../parts/runtime-words.ts';
import { bodyOf, draftOf, FIELD_LABEL, isNumberField, type SettingsDraft } from './fields.ts';

const FOLLOW = 'follow';

/**
 * One environment's settings made in Pipelines. Each field shows, greyed, the value it falls
 * back to when left empty; settings the runtime does not have are left out. Mounted per
 * opening; Cmd+Enter saves.
 */
export function SettingsDialog({
  application,
  item,
  onClose,
}: {
  application: string;
  item: ApplicationDeploySettings;
  onClose: () => void;
}) {
  const t = useT(pipelinesText);
  const { set } = useDeploySettingsWrites(application);
  const [draft, setDraft] = useState<SettingsDraft>(draftOf(item.settings));
  const parsed = bodyOf(draft);
  const wrong = parsed.ok ? null : parsed.field;
  const entry = (field: DeploySettingField) => item.effective.find((e) => e.field === field);
  const fallback = (field: DeploySettingField) => {
    const found = entry(field);
    return found && found.source !== 'pipelines' && found.value !== null ? String(found.value) : '';
  };
  const shown = DEPLOY_SETTING_FIELDS.filter((field) => entry(field)?.applies !== false);
  const submit = () => {
    if (!parsed.ok || set.isPending) return;
    set.mutate({ environment: item.environment.key, body: parsed.body }, { onSuccess: onClose });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };
  const change = (field: DeploySettingField, value: string) =>
    setDraft((now) => ({ ...now, [field]: value }));
  return (
    <Modal
      open
      onClose={onClose}
      title={t('pipelines.deploySettings.editTitle', { environment: item.environment.name })}
      description={t('pipelines.deploySettings.editDescription', {
        runtime: t(RUNTIME_NAME[item.runtime]),
      })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('pipelines.common.cancel')}
          </Button>
          <Button variant="primary" disabled={!parsed.ok} loading={set.isPending} onClick={submit}>
            {t('pipelines.deploySettings.save')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" onKeyDown={onKeyDown}>
        {shown.map((field) =>
          field === 'secretsAs' ? (
            <Field key={field} label={t(FIELD_LABEL[field])}>
              <Select
                value={draft.secretsAs || FOLLOW}
                options={[
                  {
                    value: FOLLOW,
                    label: t('pipelines.deploySettings.follow', { value: fallback(field) }),
                  },
                  { value: 'env', label: t('pipelines.deploySettings.secretsEnv') },
                  { value: 'files', label: t('pipelines.deploySettings.secretsFiles') },
                ]}
                onChange={(event) => change(field, event.value === FOLLOW ? '' : event.value)}
              />
            </Field>
          ) : (
            <Field
              key={field}
              label={t(FIELD_LABEL[field])}
              error={wrong === field ? t('pipelines.deploySettings.invalid') : null}
            >
              <Input
                mono
                inputMode={isNumberField(field) ? 'numeric' : undefined}
                value={draft[field]}
                placeholder={fallback(field)}
                onChange={(event) => change(field, event.target.value)}
              />
            </Field>
          ),
        )}
        <p className="text-12 text-tx-3 sm:col-span-2">{t('pipelines.deploySettings.emptyHint')}</p>
        <div className="sm:col-span-2">
          <ActionError error={set.error} />
        </div>
      </div>
    </Modal>
  );
}
