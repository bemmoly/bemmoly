import { useT } from '@bemmoly/core-web';
import { pipelinesText } from '../../i18n/catalog.ts';
import { LinkTabs } from '../../parts/link-tabs.tsx';

/** Releases and What changed? are two places under the Releases rail entry. */
export function ReleasesTabs() {
  const t = useT(pipelinesText);
  return (
    <LinkTabs
      label={t('pipelines.releases.tabs')}
      tabs={[
        {
          to: '/releases',
          label: t('pipelines.releases.tabReleases'),
          icon: 'rocket',
          exact: true,
        },
        { to: '/releases/changes', label: t('pipelines.releases.tabChanges'), icon: 'pulse' },
      ]}
    />
  );
}
