import { HeaderActions, navigateInApp, useT } from '@bemmoly/core-web';
import type { Journey } from '../../../shared/index.ts';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ProgressBar,
  SegmentedControl,
  Table,
  TableSkeleton,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { useDateText } from '../shared/format.ts';
import { peopleKeys } from '../shared/keys.ts';
import { PeopleLayout } from '../shared/layout.tsx';
import { peoplePaths } from '../shared/paths.ts';
import { PersonCell } from '../shared/person.tsx';
import { usePeopleById, useSession } from '../shared/queries.ts';
import { LoadError } from '../shared/states.tsx';
import { StartJourneyDialog } from './start-journey-dialog.tsx';

type Filter = 'open' | 'done' | 'all';

/** Journeys the person runs, works on or is the subject of, and the tasks waiting on them. */
export function JourneyList() {
  const t = useT(peopleText);
  const date = useDateText();
  const people = usePeopleById();
  const { can } = useSession();
  const [filter, setFilter] = useState<Filter>('open');
  const [starting, setStarting] = useState(false);
  const query = filter === 'all' ? {} : { open: filter === 'open' };
  const journeys = useQuery({
    queryKey: peopleKeys.journeys(query),
    queryFn: async () => (await api.people.journeys.list(query)).items,
  });
  const tasks = useQuery({
    queryKey: peopleKeys.myTasks(),
    queryFn: async () => (await api.people.journeys.myTasks()).items,
  });
  const name = (id: string) => people.name(id) ?? t('people.someone');

  return (
    <PeopleLayout trail={[{ label: t('people.nav.journeys'), path: peoplePaths.journeys() }]}>
      {can('people.journeys.manage') ? (
        <HeaderActions>
          <Button variant="primary" onClick={() => setStarting(true)}>
            {t('people.journeys.start')}
          </Button>
        </HeaderActions>
      ) : null}
      <Card className="overflow-hidden">
        <CardHeader title={t('people.journeys.myTasks')} />
        {(tasks.data ?? []).length === 0 ? (
          <p className="m-0 px-3.5 py-3 text-13 text-tx-3">{t('people.journeys.noTasks')}</p>
        ) : (
          (tasks.data ?? []).map((task) => (
            <a
              key={task.id}
              href={peoplePaths.journey(task.journeyId)}
              className="flex items-center gap-3 border-b border-line-2 px-3.5 py-2.5 text-13 text-tx no-underline last:border-b-0 hover:bg-hover"
            >
              <Icon name="checklist" size={15} className="text-tx-3" />
              <span className="min-w-0 flex-1 truncate">{task.title}</span>
              <span className="truncate text-tx-3">{name(task.journeyUserId)}</span>
              <span className="shrink-0 text-12 text-tx-3 tabular-nums">
                {t('people.journeys.due', { date: date(task.dueDate) })}
              </span>
            </a>
          ))
        )}
      </Card>
      <SegmentedControl
        size="sm"
        value={filter}
        onChange={setFilter}
        className="self-start"
        options={[
          { value: 'open', label: t('people.journeys.open') },
          { value: 'done', label: t('people.journeys.done') },
          { value: 'all', label: t('people.journeys.all') },
        ]}
      />
      {journeys.isPending ? (
        <TableSkeleton
          label={t('people.loading')}
          rows={5}
          columns={[{ width: 'minmax(0,2fr)' }, { width: '140px' }, { width: '160px' }]}
        />
      ) : journeys.isError ? (
        <LoadError onRetry={() => void journeys.refetch()} />
      ) : (
        <Table
          label={t('people.journeys.table')}
          rows={journeys.data}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigateInApp(peoplePaths.journey(row.id))}
          empty={
            <EmptyState
              size="sm"
              icon={<Icon name="checklist" />}
              title={t('people.journeys.emptyTitle')}
              description={t('people.journeys.emptyBody')}
            />
          }
          columns={[
            {
              key: 'person',
              header: t('people.journeys.col.person'),
              width: 'minmax(200px,2fr)',
              render: (row: Journey) => (
                <PersonCell userId={row.userId} name={name(row.userId)} detail={row.templateName} />
              ),
            },
            {
              key: 'kind',
              header: t('people.journeys.col.kind'),
              width: '130px',
              hideOnPhone: true,
              render: (row: Journey) => (
                <span className="text-13 text-tx-2">{t(`people.journeys.${row.kind}`)}</span>
              ),
            },
            {
              key: 'date',
              header: t('people.journeys.col.date'),
              width: '130px',
              render: (row: Journey) => (
                <span className="text-13 text-tx-2 tabular-nums">{date(row.anchorDate)}</span>
              ),
            },
            {
              key: 'progress',
              header: t('people.journeys.col.progress'),
              width: '170px',
              hideOnPhone: true,
              render: (row: Journey) => {
                const label = t('people.journeys.progress', {
                  done: row.doneCount,
                  total: row.taskCount,
                });
                return (
                  <span className="flex w-full flex-col gap-1">
                    <ProgressBar
                      size="sm"
                      label={label}
                      value={row.taskCount ? (row.doneCount / row.taskCount) * 100 : 0}
                    />
                    <span className="text-12 text-tx-3 tabular-nums">{label}</span>
                  </span>
                );
              },
            },
          ]}
        />
      )}
      {starting ? <StartJourneyDialog onClose={() => setStarting(false)} /> : null}
    </PeopleLayout>
  );
}
