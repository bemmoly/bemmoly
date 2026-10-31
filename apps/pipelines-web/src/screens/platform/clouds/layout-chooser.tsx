import { useT } from '@bemmoly/core-web';
import { MANAGED_LAYOUTS, type Layout } from '@bemmoly/module-pipelines/shared';
import { SelectableCard, Tag } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { pipelinesKeys } from '../../../api/pipelines.ts';
import { useDomains } from '../../../hooks/use-catalog-tree.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { api } from '../../../lib/api.ts';
import { Panel } from '../../../parts/screen.tsx';
import { LAYOUT_HINT, LAYOUT_LABEL } from './layout-words.ts';
import { summarize } from './layout-summary.ts';

const REGISTRY = {
  starter: 'pipelines.clouds.layoutRegistry.platform',
  'per-environment': 'pipelines.clouds.layoutRegistry.ci',
  'per-domain-environment': 'pipelines.clouds.layoutRegistry.ci',
} as const;

/**
 * Starter, Standard or Enterprise, each with what it would create for the environments there
 * are now: how many projects and what for, where the shared registry lives, and the
 * identities. A connection made with another layout keeps it, shown as the current one.
 */
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
  const domains = useDomains().data?.items.length ?? 0;
  const items = environments.data?.items ?? [];
  const offered: readonly Layout[] = (MANAGED_LAYOUTS as readonly Layout[]).includes(value)
    ? MANAGED_LAYOUTS
    : [...MANAGED_LAYOUTS, value];
  return (
    <Panel title={t('pipelines.clouds.layoutTitle', { unit })}>
      <div
        role="radiogroup"
        aria-label={t('pipelines.clouds.layoutTitle', { unit })}
        className="flex flex-col gap-2.5 py-1"
      >
        {offered.map((layout) => {
          const summary = summarize(layout, items, domains);
          return (
            <SelectableCard
              key={layout}
              selected={value === layout}
              onClick={() => onChange(layout)}
              className="gap-1.5 p-3.5"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t(LAYOUT_LABEL[layout], { unit })}</span>
                <span className="text-12 text-tx-3">
                  {t('pipelines.clouds.layoutProjects', {
                    projects: summary.projects,
                    created: summary.created,
                  })}
                </span>
              </span>
              <span className="text-12 text-tx-2">{t(LAYOUT_HINT[layout])}</span>
              {layout in REGISTRY && (
                <span className="flex flex-col gap-0.5 text-12 text-tx-3">
                  <span className="flex items-center gap-1.5">
                    <Icon name="box" size={12} />
                    {t(REGISTRY[layout as keyof typeof REGISTRY])}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon name="shield" size={12} />
                    {t('pipelines.clouds.layoutIdentities')}
                  </span>
                </span>
              )}
            </SelectableCard>
          );
        })}
      </div>
      <h3 className="mt-3 mb-1.5 text-11 font-semibold text-tx-2">
        {t('pipelines.platform.environments')}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((environment) => (
          <Tag key={environment.id} size="md">
            {environment.protection.protected && <Icon name="shield" size={12} />}
            {environment.name}
          </Tag>
        ))}
      </div>
    </Panel>
  );
}
