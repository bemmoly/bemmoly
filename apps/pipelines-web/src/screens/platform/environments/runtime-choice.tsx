import { useT } from '@bemmoly/core-web';
import { deployRuntimeSchema, type DeployRuntime } from '@bemmoly/module-pipelines/shared';
import { Field, Select } from '@bemmoly/ui';
import { useEnvironmentFollowers } from '../../../hooks/use-deploy-settings.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { RUNTIME_COST, RUNTIME_NAME } from '../../../parts/runtime-words.ts';

/** Who follows the default here and who chose otherwise, for an environment that exists. */
function Followers({ environment }: { environment: string }) {
  const t = useT(pipelinesText);
  const followers = useEnvironmentFollowers(environment);
  const items = followers.data?.items;
  if (!items || items.length === 0) return null;
  const follow = items.filter((item) => item.source === 'environment').length;
  const own = items.filter((item) => item.source !== 'environment');
  return (
    <p className="text-12 leading-body text-tx-3" data-testid="runtime-followers">
      {t('pipelines.runtimes.followers', { count: follow })}
      {own.length > 0 &&
        ` ${t('pipelines.runtimes.overriders', {
          list: own
            .map((item) => `${item.application.name} (${t(RUNTIME_NAME[item.runtime])})`)
            .join(', '),
        })}`}
    </p>
  );
}

/**
 * What applications here run on unless they choose otherwise, with what each choice means for
 * the bill, and for an environment that exists, who follows it.
 */
export function RuntimeChoice({
  value,
  environment,
  onChange,
}: {
  value: DeployRuntime;
  /** The environment's key once it exists; null in New environment. */
  environment: string | null;
  onChange: (runtime: DeployRuntime) => void;
}) {
  const t = useT(pipelinesText);
  return (
    <div className="flex flex-col gap-1.5">
      <Field
        label={t('pipelines.runtimes.environmentDefault')}
        hint={t('pipelines.runtimes.environmentDefaultHint')}
      >
        <Select
          value={value}
          options={deployRuntimeSchema.options.map((runtime) => ({
            value: runtime,
            label: t(RUNTIME_NAME[runtime]),
            description: t(RUNTIME_COST[runtime]),
          }))}
          onChange={(event) => onChange(deployRuntimeSchema.parse(event.value))}
        />
      </Field>
      <p className="text-12 leading-body text-tx-2" data-testid="runtime-cost">
        {t(RUNTIME_COST[value])}
      </p>
      {environment && <Followers environment={environment} />}
    </div>
  );
}
