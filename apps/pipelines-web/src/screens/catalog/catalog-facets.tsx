import { formatNumber, useT } from '@bemmoly/core-web';
import type { ApplicationFacets, FacetValue } from '@bemmoly/module-pipelines/shared';
import { EntityTile, FacetPanel, Skeleton, type EntityHue, type FacetGroup } from '@bemmoly/ui';
import { useDomains } from '../../hooks/use-catalog-tree.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { RUNTIME_WORD } from '../../parts/bits.tsx';
import { FACET_KEYS, type CatalogState, type FacetKey } from './catalog-search.ts';

/** Facets whose values are words the web app owns (the server sends the raw value). */
const WORDED: Partial<Record<FacetKey, string>> = {
  tier: 'pipelines.tier',
  lifecycle: 'pipelines.lifecycle',
  health: 'pipelines.health',
};

/** Values chosen in the address stay listed (at zero) even when nothing matches them now. */
function withChosen(values: readonly FacetValue[], chosen: readonly string[]): FacetValue[] {
  const missing = chosen
    .filter((value) => !values.some((item) => item.value === value))
    .map((value) => ({ value, label: value, count: 0 }));
  return [...values, ...missing];
}

export function CatalogFacets({
  facets,
  state,
  domains,
  onToggle,
}: {
  facets: ApplicationFacets | undefined;
  state: CatalogState;
  domains: readonly string[];
  onToggle: (key: FacetKey, value: string) => void;
}) {
  const t = useT(pipelinesText);
  const tree = useDomains().data?.items ?? [];
  if (!facets) {
    return (
      <div
        role="status"
        aria-busy
        className="flex flex-col gap-5"
        aria-label={t('pipelines.catalog.filters')}
      >
        {[5, 5, 3, 4].map((rows, group) => (
          <div key={group} className="flex flex-col gap-2.5">
            <Skeleton width={70} height={9} />
            {Array.from({ length: rows }, (_, row) => (
              <Skeleton key={row} width={`${60 + ((row * 17) % 30)}%`} height={10} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  const word = (key: FacetKey, value: FacetValue) => {
    if (key === 'team' && value.value === 'none') return t('pipelines.catalog.noOwner');
    if (key === 'runtime' && value.value in RUNTIME_WORD)
      return t(RUNTIME_WORD[value.value as keyof typeof RUNTIME_WORD]);
    const prefix = WORDED[key];
    return prefix ? t(`${prefix}.${value.value}` as 'pipelines.tier.0') : value.label;
  };
  const groups: FacetGroup[] = FACET_KEYS.map((key) => {
    const selected = key === 'domain' ? domains : state.facets[key];
    return {
      key,
      label: t(`pipelines.catalog.facet.${key}`),
      selected,
      ...(key === 'team' ? { limit: 6 } : {}),
      options: withChosen(facets[key], selected).map((value) => {
        const domain = key === 'domain' ? tree.find((item) => item.key === value.value) : undefined;
        return {
          value: value.value,
          label: word(key, value),
          count: value.count,
          ...(domain
            ? { icon: <EntityTile name={domain.name} hue={domain.color as EntityHue} size={16} /> }
            : {}),
        };
      }),
    };
  });
  return (
    <FacetPanel
      ariaLabel={t('pipelines.catalog.filters')}
      groups={groups}
      onToggle={(group, value) => onToggle(group as FacetKey, value)}
      showAllLabel={(count) => t('pipelines.catalog.showAll', { count })}
      showFewerLabel={t('pipelines.catalog.showFewer')}
      formatCount={formatNumber}
    />
  );
}
