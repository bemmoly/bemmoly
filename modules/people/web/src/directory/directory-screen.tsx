import { HeaderActions, navigateInApp, useLocale, useT } from '@bemmoly/core-web';
import { Button, EmptyState, SearchInput, Select, Table, TableSkeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useMemo, useState } from 'react';
import type { DirectoryRow } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { localTime } from '../shared/format.ts';
import { PeopleLayout } from '../shared/layout.tsx';
import { peoplePaths } from '../shared/paths.ts';
import { HappeningBadge, PersonCell } from '../shared/person.tsx';
import { useDirectory, useOrgLookups, useSession } from '../shared/queries.ts';
import { LoadError } from '../shared/states.tsx';
import { AddPersonDialog } from './add-person-dialog.tsx';

const ANY = '';

/**
 * The directory at /people: everyone with an employment record, with what is happening to
 * them. Search by name, email or title; filter by team and location; a row opens the profile.
 */
export default function DirectoryScreen() {
  const t = useT(peopleText);
  const locale = useLocale();
  const org = useOrgLookups();
  const { can } = useSession();
  const everyone = useDirectory();
  const [q, setQ] = useState('');
  const [teamId, setTeamId] = useState(ANY);
  const [locationId, setLocationId] = useState(ANY);
  const [adding, setAdding] = useState(false);
  const all = useMemo(() => everyone.data ?? [], [everyone.data]);
  const byId = useMemo(() => new Map(all.map((person) => [person.userId, person])), [all]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (person) =>
        (!teamId || person.teamId === teamId) &&
        (!locationId || person.locationId === locationId) &&
        (!needle ||
          person.name.toLowerCase().includes(needle) ||
          person.email.toLowerCase().includes(needle) ||
          (person.jobTitle ?? '').toLowerCase().includes(needle)),
    );
  }, [all, q, teamId, locationId]);
  const filtered = q !== '' || teamId !== ANY || locationId !== ANY;
  const clear = () => {
    setQ('');
    setTeamId(ANY);
    setLocationId(ANY);
  };

  const columns = [
    {
      key: 'name',
      header: t('people.directory.col.name'),
      width: 'minmax(220px,2fr)',
      render: (row: DirectoryRow) => (
        <PersonCell userId={row.userId} name={row.name} detail={row.jobTitle} />
      ),
    },
    {
      key: 'team',
      header: t('people.directory.col.team'),
      width: 'minmax(110px,1fr)',
      render: (row: DirectoryRow) => (
        <span className="truncate text-13 text-tx-2">{org.team(row.teamId)?.name ?? ''}</span>
      ),
    },
    {
      key: 'location',
      header: t('people.directory.col.location'),
      width: 'minmax(130px,1fr)',
      hideOnPhone: true,
      render: (row: DirectoryRow) => {
        const place = org.location(row.locationId);
        const time = localTime(locale, place?.timezone);
        return (
          <span className="flex min-w-0 items-baseline gap-1.5 text-13 text-tx-2">
            <span className="truncate">{place?.name ?? ''}</span>
            {time ? <span className="shrink-0 text-12 text-tx-3 tabular-nums">{time}</span> : null}
          </span>
        );
      },
    },
    {
      key: 'manager',
      header: t('people.directory.col.manager'),
      width: 'minmax(130px,1fr)',
      hideOnPhone: true,
      render: (row: DirectoryRow) => (
        <span className="truncate text-13 text-tx-2">
          {row.managerId ? (byId.get(row.managerId)?.name ?? '') : ''}
        </span>
      ),
    },
    {
      key: 'happening',
      header: t('people.directory.col.happening'),
      width: '170px',
      render: (row: DirectoryRow) => <HappeningBadge happening={row.happening} />,
    },
  ];

  return (
    <PeopleLayout trail={[{ label: t('people.nav.directory'), path: peoplePaths.directory() }]}>
      {can('workspace.people.manage') ? (
        <HeaderActions>
          <Button variant="primary" onClick={() => setAdding(true)}>
            {t('people.directory.add')}
          </Button>
        </HeaderActions>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          aria-label={t('people.directory.search')}
          placeholder={t('people.directory.search')}
          value={q}
          onChange={(event) => setQ(event.target.value)}
          wrapperClassName="w-64 max-sm:w-full"
        />
        <Select
          aria-label={t('people.directory.col.team')}
          value={teamId}
          onChange={(event) => setTeamId(event.value)}
          options={[
            { value: ANY, label: t('people.directory.anyTeam') },
            ...org.teams.map((team) => ({ value: team.id, label: team.name })),
          ]}
        />
        <Select
          aria-label={t('people.directory.col.location')}
          value={locationId}
          onChange={(event) => setLocationId(event.value)}
          options={[
            { value: ANY, label: t('people.directory.anyLocation') },
            ...org.locations.map((place) => ({ value: place.id, label: place.name })),
          ]}
        />
        <span className="ms-auto text-12 text-tx-3 tabular-nums">
          {t('people.directory.count', { shown: rows.length, total: all.length })}
        </span>
      </div>
      {everyone.isPending ? (
        <TableSkeleton
          label={t('people.loading')}
          rows={8}
          columns={columns.map((column) => ({ width: column.width }))}
        />
      ) : everyone.isError ? (
        <LoadError onRetry={() => void everyone.refetch()} />
      ) : (
        <Table
          label={t('people.directory.table')}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.userId}
          onRowClick={(row) => navigateInApp(peoplePaths.profile(row.userId))}
          empty={
            filtered ? (
              <EmptyState
                size="sm"
                icon={<Icon name="search" />}
                title={t('people.directory.noMatchTitle')}
                description={t('people.directory.noMatchBody')}
                action={
                  <Button variant="secondary" onClick={clear}>
                    {t('people.directory.clear')}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                size="sm"
                icon={<Icon name="people" />}
                title={t('people.directory.emptyTitle')}
                description={t('people.directory.emptyBody')}
              />
            )
          }
        />
      )}
      <AddPersonDialog open={adding} onClose={() => setAdding(false)} known={byId} />
    </PeopleLayout>
  );
}
