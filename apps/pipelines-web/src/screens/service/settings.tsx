import { useT } from '@bemmoly/core-web';
import type {
  ApplicationDeploySettings,
  ServiceEnvironment,
} from '@bemmoly/module-pipelines/shared';
import { Badge, Button, SegmentedControl, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useDeploySettings, useDeploySettingsWrites } from '../../hooks/use-deploy-settings.ts';
import { useSearchText } from '../../hooks/use-search-state.ts';
import { pipelinesText, servicesText } from '../../i18n/catalog.ts';
import { ActionError } from '../../parts/action-error.tsx';
import { useDeployOrPromote } from '../../parts/deploy-or-promote.tsx';
import { LoadError } from '../../parts/load-error.tsx';
import { RowsSkeleton } from '../../parts/rows-skeleton.tsx';
import { FIELD_LABEL } from '../application/settings/fields.ts';
import { VariablesTab } from '../application/variables/variables-tab.tsx';
import { CARD } from './card.ts';
import { useSettingsDraft } from './settings-draft.ts';
import { SettingsForm } from './settings-form.tsx';
import { useService, useServiceKey } from './use-service.ts';

/**
 * One environment's form beside its unsaved changes. An environment with an approval rule
 * takes its settings through a change request; any other saves them for the next deploy.
 */
function EnvironmentSettings({
  service,
  environment,
  item,
  previous,
  onEnvironment,
}: {
  service: string;
  environment: ServiceEnvironment;
  item: ApplicationDeploySettings;
  previous: ApplicationDeploySettings | null;
  onEnvironment: (key: string) => void;
}) {
  const t = useT(servicesText);
  const p = useT(pipelinesText);
  const toast = useToast();
  const { set } = useDeploySettingsWrites(service);
  const deploy = useDeployOrPromote();
  const form = useSettingsDraft(item);
  const invalid = form.parsed.ok ? null : form.parsed.field;
  const save = () => {
    if (!form.parsed.ok) return;
    set.mutate(
      { environment: environment.key, body: form.parsed.body },
      { onSuccess: () => toast.show({ tone: 'ok', title: t('pipelinesServices.settings.saved') }) },
    );
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-13 text-tx-3">
          {environment.project
            ? t('pipelinesServices.settings.forIn', {
                environment: environment.name,
                project: environment.project,
              })
            : t('pipelinesServices.settings.for', { environment: environment.name })}
        </span>
        {previous ? (
          <Button
            size="sm"
            className="ms-auto"
            icon={<Icon name="copy" size={14} />}
            onClick={() => form.copy(previous)}
          >
            {t('pipelinesServices.settings.copyFrom', { environment: previous.environment.name })}
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SettingsForm
          item={item}
          draft={form.draft}
          invalid={invalid}
          onChange={form.set}
          variables={
            <VariablesTab
              application={service}
              environment={environment.key}
              onEnvironment={(key) => key && onEnvironment(key)}
            />
          }
        />
        <aside className={`${CARD} lg:sticky lg:top-4`} aria-labelledby="unsaved">
          <div className="flex items-center gap-2">
            <h2 id="unsaved" className="text-14 font-semibold text-tx">
              {t('pipelinesServices.settings.unsaved')}
            </h2>
            {form.changes.length ? <Badge tone="accent">{form.changes.length}</Badge> : null}
          </div>
          {form.changes.length ? (
            <ul className="flex flex-col gap-1 rounded-control bg-sunken px-3 py-2 font-mono text-12">
              {form.changes.map((change) => (
                <li key={change.field} className="flex flex-col">
                  <span className="text-tx-2">{p(FIELD_LABEL[change.field])}</span>
                  <span className="text-red-tx">
                    - {change.from || t('pipelinesServices.settings.followShort')}
                  </span>
                  <span className="text-green-tx">
                    + {change.to || t('pipelinesServices.settings.followShort')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-13 text-tx-3">{t('pipelinesServices.settings.nothing')}</span>
          )}
          <span className="text-12 text-tx-3">
            {environment.hasApprovalRule
              ? t('pipelinesServices.settings.throughChange', { environment: environment.name })
              : t('pipelinesServices.settings.nextDeploy', { environment: environment.name })}
          </span>
          <ActionError error={set.error} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={!form.changes.length} onClick={form.reset}>
              {t('pipelinesServices.settings.discard')}
            </Button>
            {environment.hasApprovalRule ? (
              <Button
                variant="primary"
                disabled={!form.changes.length || invalid !== null}
                onClick={() => deploy.open({ service, environment: environment.key })}
              >
                {t('pipelinesServices.settings.writeChange')}
              </Button>
            ) : (
              <Button
                variant="primary"
                loading={set.isPending}
                disabled={!form.changes.length || invalid !== null}
                onClick={save}
              >
                {t('pipelinesServices.settings.save')}
              </Button>
            )}
          </div>
        </aside>
      </div>
      {deploy.dialog}
    </>
  );
}

/** Settings: how the service runs in each environment, one environment at a time. */
export default function ServiceSettings() {
  const t = useT(servicesText);
  const key = useServiceKey();
  const service = useService(key);
  const settings = useDeploySettings(key);
  const [chosen, setChosen] = useSearchText('env');
  const environments = service.data?.environments ?? [];
  const environment =
    environments.find((each) => each.key === chosen) ?? environments.at(-1) ?? null;
  const index = environment ? environments.indexOf(environment) : -1;
  const itemOf = (env: ServiceEnvironment | undefined) =>
    settings.data?.items.find((item) => item.environment.key === env?.key) ?? null;
  const item = environment ? itemOf(environment) : null;
  return (
    <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 md:px-6">
      {environment ? (
        <SegmentedControl
          size="sm"
          aria-label={t('pipelinesServices.logs.environment')}
          value={environment.key}
          onChange={setChosen}
          options={environments.map((each) => ({ value: each.key, label: each.name }))}
        />
      ) : null}
      {settings.isError ? (
        <LoadError
          title={t('pipelinesServices.settings.loadFailed')}
          error={settings.error}
          onRetry={() => void settings.refetch()}
        />
      ) : !settings.data || !service.data ? (
        <RowsSkeleton rows={6} />
      ) : !environment || !item ? (
        <p className="text-13 text-tx-3">{t('pipelinesServices.overview.noEnvironmentsHint')}</p>
      ) : (
        <EnvironmentSettings
          key={environment.key}
          service={key}
          environment={environment}
          item={item}
          previous={itemOf(environments[index - 1])}
          onEnvironment={setChosen}
        />
      )}
    </div>
  );
}
