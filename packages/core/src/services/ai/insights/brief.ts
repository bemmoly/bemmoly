import { fileURLToPath } from 'node:url';
import type { SqlExecutor } from '../../../contracts/sql.ts';
import { ACTIVITY_CONTEXT_BUILDER } from '../context/activity.ts';
import type { AiInsightGenerator } from './types.ts';

export const MORNING_BRIEF_PROMPT_ID = 'ai.brief';
export const MORNING_BRIEF_PROMPT_FILE = fileURLToPath(
  new URL('./prompts/brief.md', import.meta.url),
);

/** The brief is built at this local hour. */
export const BRIEF_LOCAL_HOUR = 6;
/** People not seen for this long get no brief: nobody would read it. */
const RECENTLY_SEEN_DAYS = 14;

/** The person's wall clock in their zone; UTC when the zone is unset or unknown. */
export function localClock(now: Date, timeZone: string | null): { date: string; hour: number } {
  const format = (zone: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = format(timeZone ?? 'UTC');
  } catch {
    parts = format('UTC');
  }
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour')) };
}

async function timeZoneOf(sql: SqlExecutor, userId: string): Promise<string | null | undefined> {
  const [row] = await sql<{ timezone: string | null }[]>`
    select timezone from users where id = ${userId} and status = 'active'`;
  return row ? row.timezone : undefined;
}

/**
 * The morning brief: one per person per local day. Its cache key is the local date, so it
 * stays put through the day however much changes, and the 6 a.m. job writes the next one.
 * With no activity it stores an empty brief without calling a model.
 */
export function createMorningBriefGenerator(sql: SqlExecutor): AiInsightGenerator {
  return {
    kind: 'morning_brief',
    builder: ACTIVITY_CONTEXT_BUILDER,
    promptId: MORNING_BRIEF_PROMPT_ID,
    purpose: 'brief',
    async stamp(userId, { now }) {
      const zone = await timeZoneOf(sql, userId);
      if (zone === undefined) return null;
      return `brief:${localClock(now, zone).date}`;
    },
    emptyOutput: (context) => (context.citations.length === 0 ? { points: [], next: [] } : null),
  };
}

/** People whose local clock reads 6 a.m. now and who have been around lately. */
export async function peopleDueABrief(
  sql: SqlExecutor,
  now: Date,
  optedOut: readonly string[],
): Promise<{ userId: string; localDate: string }[]> {
  const rows = await sql<{ id: string; timezone: string | null }[]>`
    select id, timezone from users
    where status = 'active'
      and last_seen_at > ${new Date(now.getTime() - RECENTLY_SEEN_DAYS * 86_400_000).toISOString()}::timestamptz`;
  return rows
    .filter((row) => !optedOut.includes(row.id))
    .map((row) => ({ userId: row.id, clock: localClock(now, row.timezone) }))
    .filter(({ clock }) => clock.hour === BRIEF_LOCAL_HOUR)
    .map(({ userId, clock }) => ({ userId, localDate: clock.date }));
}
