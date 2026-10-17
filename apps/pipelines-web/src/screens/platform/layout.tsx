import { useT } from '@bemmoly/core-web';
import { Outlet } from '@tanstack/react-router';
import { pipelinesText } from '../../i18n/catalog.ts';
import { LinkTabs } from '../../parts/link-tabs.tsx';

/**
 * Platform: the platform team's places (access, capacity, clouds, environments) under one
 * title, each with its own address. The areas draw their own headers below the tabs.
 */
export default function PlatformLayout() {
  const t = useT(pipelinesText);
  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-360 px-4 pt-5 md:px-6">
        <h1 className="mb-2 text-20 leading-title font-semibold text-tx">
          {t('pipelines.platform.title')}
        </h1>
        <LinkTabs
          label={t('pipelines.platform.areas')}
          tabs={[
            { to: '/platform/access', label: t('pipelines.platform.access'), icon: 'lock' },
            { to: '/platform/capacity', label: t('pipelines.platform.capacity'), icon: 'server' },
            { to: '/platform/clouds', label: t('pipelines.platform.clouds'), icon: 'cloud' },
            {
              to: '/platform/environments',
              label: t('pipelines.platform.environments'),
              icon: 'layers',
            },
          ]}
        />
      </div>
      <Outlet />
    </div>
  );
}
