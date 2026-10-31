import { useT } from '@bemmoly/core-web';
import { Avatar, Card, CardHeader, EmptyState, SkeletonCard } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { peopleText } from '../i18n/catalog.ts';
import type { PeopleScreenProps } from '../routes.tsx';
import { api } from '../shared/api.ts';
import { peopleKeys } from '../shared/keys.ts';
import { PeopleLayout } from '../shared/layout.tsx';
import { peoplePaths } from '../shared/paths.ts';
import { HappeningBadge, PersonCell } from '../shared/person.tsx';
import { useOrgLookups } from '../shared/queries.ts';
import { LoadError } from '../shared/states.tsx';
import { BalancesCard } from '../shared/balances.tsx';
import { EmploymentCard } from './employment-card.tsx';
import { FieldsCard } from './fields-card.tsx';

/**
 * A person's profile at /people/p/:userId: who they are and where they sit, the employment
 * facts (edited through the kernel's record), the company's fields, and their reporting line.
 */
export default function ProfileScreen({ segment }: PeopleScreenProps) {
  const t = useT(peopleText);
  const userId = segment ?? '';
  const org = useOrgLookups();
  const profile = useQuery({
    queryKey: peopleKeys.profile(userId),
    queryFn: () => api.people.profile(userId),
    enabled: Boolean(userId),
    retry: false,
  });
  const directory = { label: t('people.nav.directory'), path: peoplePaths.directory() };

  if (profile.isPending) {
    return (
      <PeopleLayout trail={[directory]}>
        <SkeletonCard />
        <SkeletonCard />
      </PeopleLayout>
    );
  }
  if (profile.isError) {
    const missing = (profile.error as { status?: number }).status === 404;
    return (
      <PeopleLayout trail={[directory]}>
        {missing ? (
          <EmptyState
            headingLevel={1}
            icon={<Icon name="user-x" />}
            title={t('people.profile.notFoundTitle')}
            description={t('people.profile.notFoundBody')}
          />
        ) : (
          <LoadError onRetry={() => void profile.refetch()} />
        )}
      </PeopleLayout>
    );
  }

  const { person, managers, reports, fields } = profile.data;
  const facts = [
    person.jobTitle,
    org.team(person.teamId)?.name,
    org.location(person.locationId)?.name,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <PeopleLayout trail={[directory, { label: person.name, path: peoplePaths.profile(userId) }]}>
      <div className="flex items-center gap-3.5">
        <Avatar name={person.name} size={48} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="m-0 truncate text-20 font-semibold text-tx">{person.name}</h1>
          <span className="truncate text-13 text-tx-2">{facts}</span>
        </div>
        <span className="ms-auto">
          <HappeningBadge happening={person.happening} />
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          <EmploymentCard person={person} />
          <FieldsCard userId={userId} fields={fields} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="overflow-hidden">
            <CardHeader title={t('people.profile.reportsTo')} />
            <div className="flex flex-col gap-2.5 px-3.5 py-3">
              {managers.length === 0 ? (
                <span className="text-13 text-tx-3">{t('people.profile.topOfChart')}</span>
              ) : (
                managers.map((manager) => (
                  <PersonCell
                    key={manager.userId}
                    userId={manager.userId}
                    name={manager.name}
                    detail={manager.jobTitle}
                  />
                ))
              )}
            </div>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title={t('people.profile.reports')} />
            <div className="flex flex-col gap-2.5 px-3.5 py-3">
              {reports.length === 0 ? (
                <span className="text-13 text-tx-3">{t('people.profile.noReports')}</span>
              ) : (
                reports.map((report) => (
                  <PersonCell
                    key={report.userId}
                    userId={report.userId}
                    name={report.name}
                    detail={report.jobTitle}
                  />
                ))
              )}
            </div>
          </Card>
          <BalancesCard userId={userId} />
        </div>
      </div>
    </PeopleLayout>
  );
}
