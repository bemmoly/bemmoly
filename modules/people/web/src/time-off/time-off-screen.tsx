import { HeaderActions, navigateInApp, useT, type PageTab } from '@bemmoly/core-web';
import { Button } from '@bemmoly/ui';
import { peopleText } from '../i18n/catalog.ts';
import type { PeopleScreenProps } from '../routes.tsx';
import { PeopleLayout } from '../shared/layout.tsx';
import { peoplePaths } from '../shared/paths.ts';
import { ApprovalsTab } from './approvals-tab.tsx';
import { CalendarTab } from './calendar-tab.tsx';
import { OverviewTab } from './overview-tab.tsx';
import { RequestDialog } from './request-dialog.tsx';

/**
 * Time off at /people/time-off: the person's balances and requests, the team calendar, and
 * the requests waiting on them. /people/time-off/new is the request dialog over the overview.
 */
export default function TimeOffScreen({ segment }: PeopleScreenProps) {
  const t = useT(peopleText);
  const tab = segment === 'calendar' || segment === 'approvals' ? segment : 'overview';
  const tabs: PageTab[] = [
    {
      id: 'overview',
      label: t('people.timeOff.overview'),
      icon: 'me',
      path: peoplePaths.timeOff(),
    },
    {
      id: 'calendar',
      label: t('people.timeOff.calendar'),
      icon: 'calendar',
      path: peoplePaths.timeOffTab('calendar'),
    },
    {
      id: 'approvals',
      label: t('people.timeOff.approvals'),
      icon: 'circle-check',
      path: peoplePaths.timeOffTab('approvals'),
    },
  ];
  return (
    <PeopleLayout
      trail={[{ label: t('people.nav.timeOff'), path: peoplePaths.timeOff() }]}
      tabs={tabs}
      activeTab={tab}
    >
      <HeaderActions>
        <Button variant="primary" onClick={() => navigateInApp(peoplePaths.newTimeOff())}>
          {t('people.timeOff.request')}
        </Button>
      </HeaderActions>
      {tab === 'calendar' ? (
        <CalendarTab />
      ) : tab === 'approvals' ? (
        <ApprovalsTab />
      ) : (
        <OverviewTab />
      )}
      {segment === 'new' ? (
        <RequestDialog onClose={() => navigateInApp(peoplePaths.timeOff(), { replace: true })} />
      ) : null}
    </PeopleLayout>
  );
}
