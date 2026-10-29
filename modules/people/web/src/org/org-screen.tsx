import { useT } from '@bemmoly/core-web';
import { Card, CardHeader, EmptyState, SegmentedControl, SkeletonCard } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import type { DirectoryRow } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { PeopleLayout } from '../shared/layout.tsx';
import { peoplePaths } from '../shared/paths.ts';
import { HappeningBadge, PersonCell } from '../shared/person.tsx';
import { useDirectory, useOrgLookups } from '../shared/queries.ts';
import { LoadError } from '../shared/states.tsx';
import { OrgTree } from './org-tree.tsx';

type View = 'reporting' | 'teams' | 'locations' | 'costCentres';

const KEY: Record<Exclude<View, 'reporting'>, keyof DirectoryRow> = {
  teams: 'teamId',
  locations: 'locationId',
  costCentres: 'costCentreId',
};

/**
 * The org chart at /people/org, drawn from the person record so it is never out of date:
 * the reporting lines as a tree, or everyone grouped by team, location or cost centre.
 */
export default function OrgScreen() {
  const t = useT(peopleText);
  const org = useOrgLookups();
  const everyone = useDirectory();
  const [view, setView] = useState<View>('reporting');
  const people = everyone.data ?? [];

  const groupName = (id: string | null): string => {
    if (!id) return t('people.org.unassigned');
    if (view === 'teams') return org.team(id)?.name ?? t('people.org.unassigned');
    if (view === 'locations') return org.location(id)?.name ?? t('people.org.unassigned');
    const cc = org.costCentre(id);
    return cc ? `${cc.code} · ${cc.name}` : t('people.org.unassigned');
  };
  const groups = () => {
    const key = KEY[view as keyof typeof KEY];
    const by = new Map<string | null, DirectoryRow[]>();
    for (const person of people) {
      const id = (person[key] as string | null) ?? null;
      by.set(id, [...(by.get(id) ?? []), person]);
    }
    return [...by.entries()].sort(([a], [b]) =>
      a === null ? 1 : b === null ? -1 : groupName(a).localeCompare(groupName(b)),
    );
  };

  return (
    <PeopleLayout trail={[{ label: t('people.nav.org'), path: peoplePaths.org() }]}>
      <SegmentedControl
        size="sm"
        value={view}
        onChange={setView}
        options={[
          { value: 'reporting', label: t('people.org.reporting') },
          { value: 'teams', label: t('people.org.teams') },
          { value: 'locations', label: t('people.org.locations') },
          { value: 'costCentres', label: t('people.org.costCentres') },
        ]}
        className="self-start"
      />
      {everyone.isPending ? (
        <SkeletonCard />
      ) : everyone.isError ? (
        <LoadError onRetry={() => void everyone.refetch()} />
      ) : people.length === 0 ? (
        <EmptyState
          icon={<Icon name="people" />}
          title={t('people.directory.emptyTitle')}
          description={t('people.directory.emptyBody')}
        />
      ) : view === 'reporting' ? (
        <Card className="overflow-hidden">
          <OrgTree people={people} label={t('people.org.reporting')} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups().map(([id, members]) => (
            <Card key={id ?? 'none'} className="overflow-hidden">
              <CardHeader
                title={groupName(id)}
                hint={t('people.org.groupCount', { count: members.length })}
              />
              <ul className="m-0 flex list-none flex-col gap-2.5 px-3.5 py-3">
                {members.map((person) => (
                  <li key={person.userId} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <PersonCell
                        userId={person.userId}
                        name={person.name}
                        detail={person.jobTitle}
                      />
                    </span>
                    <HappeningBadge happening={person.happening} />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </PeopleLayout>
  );
}
