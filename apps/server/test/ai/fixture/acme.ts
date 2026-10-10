/*
 * The Acme Labs sample from the mocks (Home, Issue, Board, Doc Editor, Docs): the Platform
 * project, Sprint 14, the session store migration and the Auth service RFC. One conflict is
 * planted on purpose, as the Doc Editor and Docs mocks show it: the RFC's Rollback section
 * says sessions stay valid for 15 minutes, while PLT-204 and the runbook say the
 * auth_pg_sessions flag keeps them for 30. The consistency eval must find it.
 */

export const TODAY = '2026-10-12';

export const PEOPLE = {
  rohan: { id: 'u-rohan', name: 'Rohan S.' },
  aisha: { id: 'u-aisha', name: 'Aisha K.' },
  jonas: { id: 'u-jonas', name: 'Jonas M.' },
  priya: { id: 'u-priya', name: 'Priya N.' },
  lena: { id: 'u-lena', name: 'Lena T.' },
} as const;

export const PROJECTS = [
  { id: 'p-plt', key: 'PLT', name: 'Platform' },
  { id: 'p-sup', key: 'SUP', name: 'Support' },
] as const;

export const SPRINTS = [
  {
    id: 's-14',
    name: 'Sprint 14',
    project: 'PLT',
    state: 'active',
    start: '2026-10-05',
    end: '2026-10-16',
    committedPoints: 23,
    donePoints: 9,
  },
  {
    id: 's-15',
    name: 'Sprint 15',
    project: 'PLT',
    state: 'planned',
    start: '2026-10-19',
    end: '2026-10-30',
    committedPoints: 0,
    donePoints: 0,
  },
] as const;

export interface AcmeIssue {
  key: string;
  title: string;
  status: 'To do' | 'In progress' | 'Code review' | 'Testing' | 'Done';
  assignee: keyof typeof PEOPLE;
  priority: 'highest' | 'high' | 'medium' | 'low';
  points: number;
  sprint: 'Sprint 14' | 'Sprint 15' | null;
  blockedBy: string[];
  description: string;
  /** Days since the issue last moved, for the sprint pulse. */
  idleDays: number;
}

export const ISSUES: readonly AcmeIssue[] = [
  {
    key: 'PLT-204',
    title: 'Session store migration to Postgres',
    status: 'Code review',
    assignee: 'aisha',
    priority: 'highest',
    points: 5,
    sprint: 'Sprint 14',
    blockedBy: [],
    description:
      'Move session storage from the Redis cluster to Postgres so sessions survive cache ' +
      'evictions. Dual-write behind the auth_pg_sessions flag, then cut reads. The ' +
      'auth_pg_sessions flag keeps sessions for 30 minutes after it is turned off, so nobody ' +
      'is logged out on rollback. Redis stays warm for 7 days. PR #4821 waits on review from ' +
      'Jonas M. since Thursday.',
    idleDays: 4,
  },
  {
    key: 'PLT-211',
    title: 'Session cleanup background job',
    status: 'To do',
    assignee: 'jonas',
    priority: 'medium',
    points: 3,
    sprint: 'Sprint 14',
    blockedBy: ['PLT-204'],
    description: 'Delete expired session rows nightly once reads come from Postgres.',
    idleDays: 6,
  },
  {
    key: 'PLT-219',
    title: 'Remove legacy cookie path from monolith',
    status: 'To do',
    assignee: 'jonas',
    priority: 'low',
    points: 2,
    sprint: 'Sprint 14',
    blockedBy: ['PLT-204'],
    description: 'Drop the monolith cookie fallback after cutover.',
    idleDays: 6,
  },
  {
    key: 'PLT-218',
    title: 'Rotate service tokens on every deploy',
    status: 'In progress',
    assignee: 'priya',
    priority: 'highest',
    points: 5,
    sprint: 'Sprint 14',
    blockedBy: [],
    description: 'Issue a fresh service token on each deploy and revoke the previous one.',
    idleDays: 1,
  },
  {
    key: 'PLT-222',
    title: 'Rate-limit token refresh endpoint',
    status: 'To do',
    assignee: 'aisha',
    priority: 'medium',
    points: 3,
    sprint: 'Sprint 14',
    blockedBy: [],
    description: 'Limit /auth/refresh to 10 requests a minute per session before GA.',
    idleDays: 2,
  },
  {
    key: 'PLT-226',
    title: 'Refresh token reused after logout on Safari',
    status: 'In progress',
    assignee: 'lena',
    priority: 'high',
    points: 2,
    sprint: 'Sprint 14',
    blockedBy: [],
    description: 'Safari replays the old refresh token after logout; revoke it server side.',
    idleDays: 1,
  },
  {
    key: 'PLT-209',
    title: 'Health checks and alerting for auth service',
    status: 'Done',
    assignee: 'priya',
    priority: 'medium',
    points: 3,
    sprint: 'Sprint 14',
    blockedBy: [],
    description: 'Readiness probe and an error-rate alert at 0.5%.',
    idleDays: 3,
  },
];

export interface AcmeSection {
  heading: string | null;
  anchor: string;
  paragraphs: string[];
}

export interface AcmePage {
  id: string;
  title: string;
  space: string;
  status: 'draft' | 'in review' | 'published';
  sections: AcmeSection[];
  /** Issue keys the page embeds. */
  issues: string[];
}

export const RFC: AcmePage = {
  id: 'pg-rfc',
  title: 'Auth service RFC',
  space: 'Engineering',
  status: 'in review',
  issues: ['PLT-204', 'PLT-218', 'PLT-222'],
  sections: [
    {
      heading: null,
      anchor: 'tldr',
      paragraphs: [
        'Move sessions from Redis to Postgres behind a flag; dual-write, cut reads, keep Redis warm 7 days.',
      ],
    },
    {
      heading: 'Context',
      anchor: 'context',
      paragraphs: [
        "We're moving session handling out of the monolith into a standalone auth service. Sessions currently live in a Redis cluster with no durability guarantees.",
      ],
    },
    {
      heading: 'Rollout plan',
      anchor: 'rollout-plan',
      paragraphs: [
        'Step 1: dual-write sessions to Redis and Postgres behind auth_pg_sessions (PLT-204).',
        'Step 2: rotate service tokens on every deploy (PLT-218).',
        'Step 3: rate-limit the refresh endpoint before GA (PLT-222).',
        'Step 4: remove the legacy cookie path.',
      ],
    },
    {
      heading: 'Rollback',
      anchor: 'rollback',
      paragraphs: [
        "If error rates exceed 0.5% after cutover, flip auth_pg_sessions off. Sessions issued by the new service stay valid for 15 minutes, so users aren't logged out (PLT-204).",
        'Redis stays warm for 7 days after cutover. On-call follows the Session migration runbook.',
      ],
    },
  ],
};

export const RUNBOOK: AcmePage = {
  id: 'pg-runbook',
  title: 'Session migration runbook',
  space: 'Engineering',
  status: 'published',
  issues: ['PLT-204'],
  sections: [
    {
      heading: 'Turning the flag off',
      anchor: 'flag-off',
      paragraphs: [
        'Flip auth_pg_sessions off in the flag console. Sessions keep working for 30 minutes, the flag TTL in auth/flags.go.',
      ],
    },
  ],
};

export interface AcmeComment {
  id: string;
  page: string;
  author: keyof typeof PEOPLE;
  quote: string | null;
  body: string;
  at: string;
  resolved: boolean;
}

export const COMMENTS: readonly AcmeComment[] = [
  {
    id: 'cm-1',
    page: RFC.id,
    author: 'jonas',
    quote: 'stay valid for 15 minutes',
    body: 'Rollback says 15 min but the flag TTL in code is 30. Which is it?',
    at: '2026-10-11',
    resolved: false,
  },
  {
    id: 'cm-2',
    page: RFC.id,
    author: 'jonas',
    quote: 'Step 4: remove the legacy cookie path.',
    body: 'Who owns this step? There is no tracking issue yet.',
    at: '2026-10-11',
    resolved: false,
  },
  {
    id: 'cm-3',
    page: RFC.id,
    author: 'priya',
    quote: null,
    body: 'Looks good to me once the TTL question is settled.',
    at: '2026-10-10',
    resolved: true,
  },
];

export const issueByKey = (key: string): AcmeIssue | undefined =>
  ISSUES.find((issue) => issue.key === key);

export const nameOf = (person: keyof typeof PEOPLE): string => PEOPLE[person].name;
