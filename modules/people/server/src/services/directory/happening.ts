import type { Person, SqlExecutor } from '@bemmoly/core';
import type { Happening } from '../../../../shared/profiles.ts';
import { addDays } from '../../../../shared/leave-days.ts';
import { dateOf } from '../common.ts';

/** How far ahead the directory looks for joiners and for time off. */
const JOINING_WITHIN = 45;
const AWAY_WITHIN = 14;

interface AwayRow {
  user_id: string;
  start_date: Date | string;
  end_date: Date | string;
}

/**
 * What is happening to each person, the one most worth knowing: leaving, then joining, then
 * away today, then away soon. Approved time off only; a request still waiting is not news.
 */
export async function happeningFor(
  sql: SqlExecutor,
  people: readonly Person[],
  day: string,
): Promise<Map<string, Happening>> {
  const out = new Map<string, Happening>();
  const ids = people.map((person) => person.userId);
  const away = ids.length
    ? await sql<AwayRow[]>`
        select distinct on (user_id) user_id, start_date, end_date from leave_requests
        where user_id = any(${ids}::uuid[]) and status = 'approved'
          and end_date >= ${day}::date and start_date <= ${addDays(day, AWAY_WITHIN)}::date
        order by user_id, start_date`
    : [];
  const awayBy = new Map(away.map((row) => [row.user_id, row]));
  for (const person of people) {
    if (person.state === 'leaving' && person.endDate) {
      out.set(person.userId, { kind: 'leaving', date: person.endDate, until: null });
      continue;
    }
    const joining =
      person.startDate &&
      person.startDate >= day &&
      person.startDate <= addDays(day, JOINING_WITHIN) &&
      (person.state === 'offer_accepted' || person.state === 'active');
    if (joining && person.startDate) {
      out.set(person.userId, { kind: 'joining', date: person.startDate, until: null });
      continue;
    }
    const leave = awayBy.get(person.userId);
    if (leave) {
      const start = dateOf(leave.start_date);
      out.set(person.userId, {
        kind: start <= day ? 'away' : 'away_soon',
        date: start,
        until: dateOf(leave.end_date),
      });
    }
  }
  return out;
}
