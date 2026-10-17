import { useT } from '@bemmoly/core-web';
import type { Provider, ProviderInfo } from '@bemmoly/module-pipelines/shared';
import { SelectableCard, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useProviders } from '../../../hooks/use-clouds.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';

/** Google Cloud first, this machine last; clouds not ready yet say "Coming soon" and nothing else. */
const ORDER: readonly Provider[] = ['gcp', 'aws', 'azure', 'kubernetes', 'local'];

export function ProviderCards({
  value,
  onChange,
}: {
  value: Provider | null;
  onChange: (provider: ProviderInfo) => void;
}) {
  const t = useT(pipelinesText);
  const providers = useProviders();
  const items = [...(providers.data?.items ?? [])].sort(
    (a, b) => ORDER.indexOf(a.provider) - ORDER.indexOf(b.provider),
  );
  return (
    <div
      role="radiogroup"
      aria-label={t('pipelines.clouds.provider')}
      className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-5"
    >
      {providers.isPending && ORDER.map((key) => <Skeleton key={key} height={84} shape="block" />)}
      {items.map((provider) => {
        const soon = provider.availability === 'coming_soon';
        return (
          <SelectableCard
            key={provider.provider}
            selected={value === provider.provider}
            disabled={soon}
            aria-disabled={soon}
            onClick={() => !soon && onChange(provider)}
            className="gap-1 p-3.5 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2">
              <Icon name="cloud" size={16} className="text-tx-2" />
              <span className="font-medium">{provider.name}</span>
              {soon && (
                <span className="ms-auto shrink-0 rounded-chip bg-line-2 px-1.5 py-px text-11 whitespace-nowrap text-tx-2">
                  {t('pipelines.clouds.comingSoon')}
                </span>
              )}
            </span>
            <span className={soon ? 'text-12 text-tx-3' : 'text-12 text-tx-2'}>
              {provider.description}
            </span>
          </SelectableCard>
        );
      })}
    </div>
  );
}
