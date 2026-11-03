import { useT } from '@bemmoly/core-web';
import { Outlet } from '@tanstack/react-router';
import { pipelinesText, setupText } from '../../i18n/catalog.ts';
import { LinkTabs } from '../../parts/link-tabs.tsx';

/**
 * Platform: the platform admin's places (clouds, people and roles, approval rules, templates,
 * runners, then the older areas) under one title, each with its own address. The areas draw their own headers below the tabs.
 */
export default function PlatformLayout() {
  const t = useT(pipelinesText);
  const setup = useT(setupText);
  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-360 px-4 pt-5 md:px-6">
        <h1 className="mb-2 text-20 leading-title font-semibold text-tx">
          {t('pipelines.platform.title')}
        </h1>
        <LinkTabs
          label={t('pipelines.platform.areas')}
          tabs={[
            { to: '/platform/clouds', label: t('pipelines.platform.clouds'), icon: 'cloud' },
            { to: '/platform/people', label: t('pipelines.platform.people'), icon: 'user' },
            {
              to: '/platform/approvals',
              label: t('pipelines.platform.approvals'),
              icon: 'checklist',
            },
            { to: '/platform/templates', label: t('pipelines.platform.templates'), icon: 'shapes' },
            { to: '/platform/runners', label: t('pipelines.platform.runners'), icon: 'server' },
            {
              to: '/platform/settings',
              label: setup('pipelinesSetup.settings.tab'),
              icon: 'sliders',
            },
            // The older areas keep their tabs until they fold into the five above.
            { to: '/platform/access', label: t('pipelines.platform.access'), icon: 'lock' },
            { to: '/platform/capacity', label: t('pipelines.platform.capacity'), icon: 'server' },
            {
              to: '/platform/environments',
              label: t('pipelines.platform.environments'),
              icon: 'layers',
            },
            { to: '/platform/clusters', label: t('pipelines.platform.clusters'), icon: 'hexagon' },
            { to: '/platform/export', label: t('pipelines.platform.export'), icon: 'download' },
          ]}
        />
      </div>
      <Outlet />
    </div>
  );
}
