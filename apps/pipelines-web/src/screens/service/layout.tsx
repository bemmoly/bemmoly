import { useT } from '@bemmoly/core-web';
import { Outlet, useParams } from '@tanstack/react-router';
import { servicesText } from '../../i18n/catalog.ts';
import { LinkTabs } from '../../parts/link-tabs.tsx';

/**
 * A service's page: its name over the tabs, each tab its own address under /services/<key>.
 * Stream S5 builds the header and every tab but Pipelines, which is stream S4's.
 */
export default function ServiceLayout() {
  const t = useT(servicesText);
  const { key = '' } = useParams({ strict: false }) as { key?: string };
  const at = `/services/${key}`;
  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-360 px-4 pt-5 md:px-6">
        <h1 className="mb-2 text-20 leading-title font-semibold text-tx">{key}</h1>
        <LinkTabs
          label={t('pipelinesServices.service.tabs')}
          tabs={[
            { to: at, label: t('pipelinesServices.tab.overview'), exact: true },
            { to: `${at}/versions`, label: t('pipelinesServices.tab.versions') },
            { to: `${at}/runs`, label: t('pipelinesServices.tab.runs') },
            { to: `${at}/pipelines`, label: t('pipelinesServices.tab.pipelines') },
            { to: `${at}/settings`, label: t('pipelinesServices.tab.settings') },
            { to: `${at}/logs`, label: t('pipelinesServices.tab.logs') },
          ]}
        />
      </div>
      <Outlet />
    </div>
  );
}
