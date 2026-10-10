import type { Notification } from '@bemmoly/shared';
import { USER_IDS } from './people.ts';
import { ago, uid } from './time.ts';

type Person = keyof typeof USER_IDS;

interface NoteSeed {
  id: string;
  kind: 'mention' | 'review_request' | 'assignment' | 'comment' | 'status_change';
  /** One entry per person; two or more make a grouped entry, as the server groups them. */
  actors: Array<[Person, string]>;
  target: { kind: 'issue' | 'page'; id: string; label: string; url: string };
  body: string;
  minutesAgo: number;
  read?: boolean;
  done?: boolean;
}

/** The server's phrasing per kind, so summaries read as the real inbox's. */
const VERBS: Record<NoteSeed['kind'], string> = {
  mention: 'mentioned you in',
  review_request: 'requested your review on',
  assignment: 'assigned you',
  comment: 'commented on',
  status_change: 'moved',
};

const issue = (key: string) =>
  ({ kind: 'issue', id: key, label: key, url: `/work/issue/${key}` }) as const;

/** The Docs seed's "RFC: Move sessions to Postgres" page (seed number 5101). */
const SESSIONS_RFC = uid(5101);

const HOUR = 60;
const DAY = 24 * HOUR;

/*
 * Today, yesterday and earlier, so the triage inbox has every date heading.
 * Four entries are unread (the e2e badge reads "Inbox, 4") and two are already
 * done; the first stays an open review request, which the e2e opens.
 */
const NOTES: NoteSeed[] = [
  {
    id: 'n-1',
    kind: 'review_request',
    actors: [['aisha', 'Aisha K.']],
    target: issue('PLT-204'),
    body: 'Backfill finished on staging, 0 mismatches across 2.1M rows. Ready for a look before we flip the flag.',
    minutesAgo: 25,
  },
  {
    id: 'n-2',
    kind: 'mention',
    actors: [['priya', 'Priya N.']],
    target: issue('PLT-218'),
    body: '@Rohan can you confirm the deploy hook fires before the health check?',
    minutesAgo: 70,
  },
  {
    id: 'n-3',
    kind: 'comment',
    actors: [
      ['jonas', 'Jonas M.'],
      ['aisha', 'Aisha K.'],
    ],
    target: {
      kind: 'page',
      id: SESSIONS_RFC,
      label: 'RFC: Move sessions to Postgres',
      url: `/docs/p/${SESSIONS_RFC}`,
    },
    body: 'Rollback section says 15 min but the flag TTL is 30. Which is it?',
    minutesAgo: 3 * HOUR,
  },
  {
    id: 'n-4',
    kind: 'assignment',
    actors: [['lena', 'Lena T.']],
    target: issue('PLT-246'),
    body: 'Picking this up next sprint; you know the session store best.',
    minutesAgo: 5 * HOUR,
    read: true,
  },
  {
    id: 'n-5',
    kind: 'status_change',
    actors: [['lena', 'Lena T.']],
    target: issue('PLT-226'),
    body: 'Moved from In progress to In review',
    minutesAgo: DAY + 2 * HOUR,
  },
  {
    id: 'n-6',
    kind: 'comment',
    actors: [['priya', 'Priya N.']],
    target: issue('PLT-211'),
    body: 'The retry budget looks right to me. Shipping behind the flag.',
    minutesAgo: DAY + 4 * HOUR,
    read: true,
  },
  {
    id: 'n-7',
    kind: 'mention',
    actors: [['jonas', 'Jonas M.']],
    target: issue('PLT-219'),
    body: '@Rohan the iOS client still sends the old header; can we keep both for a release?',
    minutesAgo: DAY + 6 * HOUR,
    read: true,
  },
  {
    id: 'n-8',
    kind: 'review_request',
    actors: [['priya', 'Priya N.']],
    target: issue('PLT-230'),
    body: 'Small one: the migration adds an index concurrently, nothing else.',
    minutesAgo: 3 * DAY,
    read: true,
  },
  {
    id: 'n-9',
    kind: 'assignment',
    actors: [['aisha', 'Aisha K.']],
    target: issue('PLT-233'),
    body: 'Handing this over while I am out on Friday.',
    minutesAgo: 4 * DAY,
    read: true,
    done: true,
  },
  {
    id: 'n-10',
    kind: 'status_change',
    actors: [['jonas', 'Jonas M.']],
    target: issue('PLT-201'),
    body: 'Moved from In review to Done',
    minutesAgo: 6 * DAY,
    read: true,
    done: true,
  },
];

function summaryOf(names: string[], verb: string, label: string): string {
  const [first = '', second] = names;
  const who =
    names.length > 2
      ? `${first} and ${names.length - 1} others`
      : second
        ? `${first} and ${second}`
        : first;
  return `${who} ${verb} ${label}`;
}

/** The triage inbox's entries, already grouped the way the server groups. */
export function seedNotifications(): Notification[] {
  return NOTES.map((note) => {
    const ids = note.actors.map((_, index) => (index === 0 ? note.id : `${note.id}-${index}`));
    const verb = VERBS[note.kind];
    return {
      id: note.id,
      ids,
      kind: note.kind,
      verb,
      summary: summaryOf(
        note.actors.map(([, name]) => name),
        verb,
        note.target.label,
      ),
      actors: note.actors.map(([key, name]) => ({ id: USER_IDS[key], name })),
      actorCount: note.actors.length,
      target: { ...note.target },
      body: note.body,
      read: note.read ?? false,
      done: note.done ?? false,
      snoozedUntil: null,
      createdAt: ago(note.minutesAgo),
    };
  });
}
