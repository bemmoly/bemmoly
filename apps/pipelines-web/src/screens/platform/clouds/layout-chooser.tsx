import { useT } from '@bemmoly/core-web';
import { layoutSchema, type Layout } from '@bemmoly/module-pipelines/shared';
import { Radio, Tag } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { pipelinesKeys } from '../../../api/pipelines.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { api } from '../../../lib/api.ts';
import { Panel } from '../../../parts/screen.tsx';

/** How environments map to cloud accounts, and the environments that will get one. */
export function LayoutChooser({
  value,
  unit,
  onChange,
}: {
  value: Layout;
  unit: string;
  onChange: (layout: Layout) => void;
}) {
  const t = useT(pipelinesText);
  const environments = useQuery({
    queryKey: pipelinesKeys.environments(),
    queryFn: () => api.pipelines.environments(),
    staleTime: 5 * 60_000,
  });
  return (
    <Panel title={t('pipelines.clouds.layoutTitle', { unit })}>
      <fieldset className="flex flex-col gap-2.5 py-1">
        <legend className="sr-only">{t('pipelines.clouds.layoutTitle', { unit })}</legend>
        {layoutSchema.options.map((layout) => (
          <Radio
            key={layout}
            name="layout"
            checked={value === layout}
            onChange={() => onChange(layout)}
            label={t(`pipelines.clouds.layout.${layout}`, { unit })}
            description={t(`pipelines.clouds.layoutHint.${layout}`)}
          />
        ))}
      </fieldset>
      <h3 className="mt-3 mb-1.5 text-11 font-semibold text-tx-2">
        {t('pipelines.platform.environments')}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {environments.data?.items.map((environment) => (
          <Tag key={environment.id} size="md">
            {environment.protection.protected && <Icon name="shield" size={12} />}
            {environment.name}
          </Tag>
        ))}
      </div>
    </Panel>
  );
}
