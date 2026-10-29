import { PageLayout, useT, type ModuleSettingsProps, type PageTab } from '@bemmoly/core-web';
import { peopleText } from './i18n/catalog.ts';
import { CostCentresTab } from './settings/cost-centres-tab.tsx';
import { FieldsTab } from './settings/fields-tab.tsx';
import { JourneysTab } from './settings/journeys-tab.tsx';
import { LeaveTab } from './settings/leave-tab.tsx';
import { LevelsTab } from './settings/levels-tab.tsx';
import { LocationsTab } from './settings/locations-tab.tsx';
import { peoplePaths } from './shared/paths.ts';

const TABS = {
  locations: LocationsTab,
  'cost-centres': CostCentresTab,
  levels: LevelsTab,
  leave: LeaveTab,
  journeys: JourneysTab,
  fields: FieldsTab,
} as const;

type TabId = keyof typeof TABS;

/**
 * Settings › People (/settings/people): the org data People reads (locations and cost
 * centres, the kernel's), and People's own ladder, leave policies, journey templates and
 * profile fields. Each section is a header tab.
 */
export default function PeopleSettings({ crumbs, subpath }: ModuleSettingsProps) {
  const t = useT(peopleText);
  const first = subpath.split('/').filter(Boolean)[0] ?? 'locations';
  const active: TabId = first in TABS ? (first as TabId) : 'locations';
  const tabs: PageTab[] = [
    {
      id: 'locations',
      label: t('people.settings.locations'),
      icon: 'map',
      path: peoplePaths.settings(),
    },
    {
      id: 'cost-centres',
      label: t('people.settings.costCentres'),
      icon: 'building',
      path: peoplePaths.settings('cost-centres'),
    },
    {
      id: 'levels',
      label: t('people.settings.levels'),
      icon: 'layers',
      path: peoplePaths.settings('levels'),
    },
    {
      id: 'leave',
      label: t('people.settings.leave'),
      icon: 'calendar',
      path: peoplePaths.settings('leave'),
    },
    {
      id: 'journeys',
      label: t('people.settings.journeys'),
      icon: 'checklist',
      path: peoplePaths.settings('journeys'),
    },
    {
      id: 'fields',
      label: t('people.settings.fields'),
      icon: 'sliders',
      path: peoplePaths.settings('fields'),
    },
  ];
  const Tab = TABS[active];
  return (
    <PageLayout layout="contained" header={{ crumbs, tabs, activeTab: active }}>
      <div data-module="people" className="flex min-w-0 flex-col gap-4">
        <Tab />
      </div>
    </PageLayout>
  );
}
