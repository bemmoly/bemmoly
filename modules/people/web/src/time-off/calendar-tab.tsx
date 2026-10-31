import { useT } from '@bemmoly/core-web';
import { Card, IconButton, Select, SkeletonCard } from '@bemmoly/ui';
import { useState } from 'react';
import type { Absence } from '../../../shared/index.ts';
import { addDays, datesBetween, isWeekend } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { todayIso, useDateText } from '../shared/format.ts';
import { PersonCell } from '../shared/person.tsx';
import { useOrgLookups, usePeopleById } from '../shared/queries.ts';
import { LoadError } from '../shared/states.tsx';
import { useAbsences } from './queries.ts';

const DAYS = 14;

/** The Monday of the week `date` falls in. */
function mondayOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

function Cell({ date, absence, label }: { date: string; absence?: Absence; label: string }) {
  const tone = absence
    ? absence.status === 'approved'
      ? 'bg-acc-fill'
      : 'border border-dashed border-acc bg-acc-50'
    : isWeekend(date)
      ? 'bg-sunken'
      : '';
  return (
    <span
      role="gridcell"
      aria-label={label}
      className="flex h-9 items-center justify-center px-0.5"
    >
      <span className={`block h-5 w-full rounded-chip ${tone}`} />
    </span>
  );
}

/**
 * The team calendar: two weeks at a time, one row per person away in them, approved days
 * filled and waiting ones outlined. Everyone sees who is away; the reason only those who may.
 */
export function CalendarTab() {
  const t = useT(peopleText);
  const date = useDateText();
  const org = useOrgLookups();
  const people = usePeopleById();
  const [from, setFrom] = useState(() => mondayOf(todayIso()));
  const [teamId, setTeamId] = useState('');
  const to = addDays(from, DAYS - 1);
  const absences = useAbsences(from, to, teamId || undefined);
  const days = datesBetween(from, to);
  const byPerson = new Map<string, Absence[]>();
  for (const absence of absences.data ?? []) {
    byPerson.set(absence.userId, [...(byPerson.get(absence.userId) ?? []), absence]);
  }
  const today = todayIso();
  const columns = `minmax(180px,1.5fr) repeat(${DAYS}, minmax(30px,1fr))`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label={t('people.calendar.team')}
          value={teamId}
          onChange={(event) => setTeamId(event.value)}
          options={[
            { value: '', label: t('people.calendar.everyone') },
            ...org.teams.map((team) => ({ value: team.id, label: team.name })),
          ]}
        />
        <IconButton
          icon="arrow-left"
          label={t('people.calendar.previous')}
          variant="secondary"
          onClick={() => setFrom(addDays(from, -DAYS))}
        />
        <IconButton
          icon="arrow-right"
          label={t('people.calendar.next')}
          variant="secondary"
          onClick={() => setFrom(addDays(from, DAYS))}
        />
        <span className="text-13 text-tx-2 tabular-nums">
          {t('people.timeOff.range', { start: date(from), end: date(to) })}
        </span>
        <span className="ms-auto flex items-center gap-3 text-12 text-tx-3">
          <span className="flex items-center gap-1.5">
            <span className="block size-3 rounded-chip bg-acc-fill" />
            {t('people.calendar.legendApproved')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="block size-3 rounded-chip border border-dashed border-acc bg-acc-50" />
            {t('people.calendar.legendPending')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="block size-3 rounded-chip bg-sunken" />
            {t('people.calendar.legendWeekend')}
          </span>
        </span>
      </div>
      {absences.isPending ? (
        <SkeletonCard />
      ) : absences.isError ? (
        <LoadError onRetry={() => void absences.refetch()} />
      ) : (
        <Card className="overflow-x-auto">
          <div
            role="grid"
            aria-label={t('people.calendar.label', { start: date(from), end: date(to) })}
            className="min-w-180"
          >
            <div
              role="row"
              className="grid border-b border-line-2 px-3.5"
              style={{ gridTemplateColumns: columns }}
            >
              <span role="columnheader" />
              {days.map((day) => (
                <span
                  key={day}
                  role="columnheader"
                  className={`py-2 text-center text-11 tabular-nums ${day === today ? 'font-semibold text-acc' : 'text-tx-3'}`}
                >
                  {Number(day.slice(8))}
                </span>
              ))}
            </div>
            {byPerson.size === 0 ? (
              <p className="m-0 px-3.5 py-4 text-13 text-tx-3">{t('people.calendar.nobody')}</p>
            ) : (
              [...byPerson.entries()].map(([userId, list]) => {
                const name = people.name(userId) ?? t('people.someone');
                return (
                  <div
                    key={userId}
                    role="row"
                    className="grid items-center border-b border-line-2 px-3.5 last:border-b-0"
                    style={{ gridTemplateColumns: columns }}
                  >
                    <span role="rowheader" className="min-w-0 py-1.5">
                      <PersonCell userId={userId} name={name} size={22} />
                    </span>
                    {days.map((day) => {
                      const absence = list.find((a) => a.startDate <= day && a.endDate >= day);
                      const what = absence
                        ? absence.kind
                          ? t(`people.kind.${absence.kind}`)
                          : t('people.kind.hidden')
                        : t('people.calendar.in');
                      return (
                        <Cell
                          key={day}
                          date={day}
                          {...(absence ? { absence } : {})}
                          label={t('people.calendar.cell', { name, date: date(day), what })}
                        />
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
