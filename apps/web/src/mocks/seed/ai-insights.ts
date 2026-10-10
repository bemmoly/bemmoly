import type { AiInsightKind } from '@bemmoly/shared';
import type { AiCitation } from '@bemmoly/shared/ai-insights';
import { DOCS_SPACE_IDS } from './docs.ts';
import { uid } from './time.ts';
import { issueId, SPRINT_IDS } from './work-issues.ts';

/*
 * Canned AI output for the Acme Labs sample, as the mocks write it: the PLT-204 summary, the
 * RFC's TL;DR and its 15-versus-30-minute contradiction, the Sprint 14 risk and Rohan's
 * morning brief. Anything else gets a plain answer built from its own title.
 */

export const RFC_PAGE_ID = uid(5101);
export const MAIN_ISSUE_ID = issueId(204);
export { DOCS_SPACE_IDS };

const issueCite = (id: string, key: string, location: string | null = null): AiCitation => ({
  id,
  kind: 'issue',
  objectId: issueId(Number(key.slice(4))),
  label: key,
  location,
  href: `/work/issue/${key}`,
});

const RFC_HREF = `/docs/p/${RFC_PAGE_ID}`;

export interface CannedInsight {
  output: unknown;
  citations: AiCitation[];
  counts: Record<string, number>;
}

const ISSUE_204: CannedInsight = {
  output: {
    points: [
      {
        text: 'Backfill verified on staging with zero mismatches across 2.1M rows.',
        cites: ['c1'],
      },
      {
        text: 'The only open item is review of PR #4821, waiting on Jonas since Thursday.',
        cites: ['c2'],
      },
      {
        text: 'Two downstream issues (PLT-211, PLT-219) are blocked on this merge.',
        cites: ['c3', 'c4'],
      },
      {
        text: "The RFC's rollback section still disagrees with the flag TTL (15 vs 30 min).",
        cites: ['c5'],
      },
    ],
    next: [
      { label: 'Open PLT-211', cite: 'c3' },
      { label: 'Read the RFC rollback', cite: 'c5' },
    ],
  },
  citations: [
    {
      id: 'c1',
      kind: 'comment',
      objectId: uid(0xd01),
      label: "Aisha K.'s comment",
      location: 'Tuesday',
      href: '/work/issue/PLT-204',
    },
    {
      id: 'c2',
      kind: 'comment',
      objectId: uid(0xd02),
      label: "Jonas M.'s comment",
      location: 'Thursday',
      href: '/work/issue/PLT-204',
    },
    issueCite('c3', 'PLT-211', 'blocked by this issue'),
    issueCite('c4', 'PLT-219', 'blocked by this issue'),
    {
      id: 'c5',
      kind: 'page',
      objectId: RFC_PAGE_ID,
      label: 'RFC: Move sessions to Postgres',
      location: 'Rollback',
      href: `${RFC_HREF}#rollback`,
    },
  ],
  counts: { comments: 14, PRs: 2, docs: 1 },
};

const RFC_TLDR: CannedInsight = {
  output: {
    points: [
      {
        text: 'Move sessions from Redis to Postgres behind a flag; dual-write, cut reads, keep Redis warm 7 days.',
        cites: ['c1', 'c2'],
      },
      { text: 'Rollback is a flag flip.', cites: ['c3'] },
      { text: 'Open question: flag TTL (15 vs 30 min).', cites: ['c3', 'c4'] },
    ],
  },
  citations: [
    {
      id: 'c1',
      kind: 'section',
      objectId: RFC_PAGE_ID,
      label: 'Summary',
      location: null,
      href: RFC_HREF,
    },
    {
      id: 'c2',
      kind: 'section',
      objectId: RFC_PAGE_ID,
      label: 'Migration order',
      location: 'Migration order',
      href: `${RFC_HREF}#migration-order`,
    },
    {
      id: 'c3',
      kind: 'section',
      objectId: RFC_PAGE_ID,
      label: 'Rollback',
      location: 'Rollback',
      href: `${RFC_HREF}#rollback`,
    },
    issueCite('c4', 'PLT-204', 'description'),
  ],
  counts: { sections: 5, issues: 3, comments: 3 },
};

const RFC_CONSISTENCY: CannedInsight = {
  output: {
    findings: [
      {
        claim: 'Sessions issued by the new service stay valid for 15 minutes.',
        location: { heading: 'Rollback', paragraph: 6 },
        issueKey: 'PLT-204',
        field: 'description',
        issueValue: 'The auth_pg_sessions flag keeps sessions for 30 minutes.',
        confidence: 0.92,
        cites: ['c1', 'c2'],
      },
    ],
  },
  citations: [
    {
      id: 'c1',
      kind: 'section',
      objectId: RFC_PAGE_ID,
      label: 'Rollback',
      location: 'Rollback, paragraph 6',
      href: `${RFC_HREF}#rollback`,
    },
    issueCite('c2', 'PLT-204', 'fields and description'),
  ],
  counts: { issues: 3, paragraphs: 4 },
};

const SPRINT_14: CannedInsight = {
  output: {
    risk: 'at_risk',
    headline: {
      text: 'PLT-204 has been in review 3 days and blocks 2 issues (5 pts). At current pace the sprint lands at 19/23 pts.',
      cites: ['c1', 'c2'],
    },
    next: [{ label: 'Open PLT-204', cite: 'c2' }],
  },
  citations: [
    {
      id: 'c1',
      kind: 'sprint',
      objectId: SPRINT_IDS.s14,
      label: 'PLT Sprint 14',
      location: null,
      href: '/work/board',
    },
    issueCite('c2', 'PLT-204', 'Code review'),
  ],
  counts: { issues: 12 },
};

const BRIEF: CannedInsight = {
  output: {
    points: [
      {
        text: 'Two things need you. PLT-204 is waiting on your review and blocks 2 issues.',
        cites: ['c1'],
      },
      { text: 'The Auth service RFC has 3 open comments from Jonas.', cites: ['c2'] },
      {
        text: 'Sprint 14 is tracking 19 of 23 points; PLT-211 and PLT-219 look unlikely to land.',
        cites: ['c3', 'c4'],
      },
    ],
    next: [
      { label: 'Review PLT-204', cite: 'c1' },
      { label: 'Open RFC comments', cite: 'c2' },
      { label: 'Plan Sprint 15', cite: 'c3' },
    ],
  },
  citations: [
    issueCite('c1', 'PLT-204', 'Code review'),
    {
      id: 'c2',
      kind: 'page',
      objectId: RFC_PAGE_ID,
      label: 'RFC: Move sessions to Postgres',
      location: '3 open comments',
      href: RFC_HREF,
    },
    {
      id: 'c3',
      kind: 'sprint',
      objectId: SPRINT_IDS.s14,
      label: 'PLT Sprint 14',
      location: null,
      href: '/work/backlog',
    },
    issueCite('c4', 'PLT-211', 'blocked'),
  ],
  counts: { updates: 31 },
};

/** The canned answer for a target, or a plain one from its title. */
export function cannedInsight(
  kind: AiInsightKind,
  targetId: string,
  describe: { title: string; href: string } | null,
): CannedInsight {
  if (kind === 'issue_summary' && targetId === MAIN_ISSUE_ID) return ISSUE_204;
  if (kind === 'page_tldr' && targetId === RFC_PAGE_ID) return RFC_TLDR;
  if (kind === 'consistency') {
    return targetId === RFC_PAGE_ID
      ? RFC_CONSISTENCY
      : { output: { findings: [] }, citations: [], counts: {} };
  }
  if (kind === 'sprint_pulse' && targetId === SPRINT_IDS.s14) return SPRINT_14;
  if (kind === 'morning_brief') return BRIEF;
  const cite: AiCitation = {
    id: 'c1',
    kind: kind === 'page_tldr' ? 'page' : kind === 'sprint_pulse' ? 'sprint' : 'issue',
    objectId: targetId,
    label: describe?.title ?? 'this item',
    location: null,
    href: describe?.href ?? null,
  };
  const title = describe?.title ?? 'This item';
  const outputs: Partial<Record<AiInsightKind, unknown>> = {
    issue_summary: {
      points: [
        {
          text: `${title}: no blockers reported; the last activity was a status change.`,
          cites: ['c1'],
        },
      ],
      next: [],
    },
    page_tldr: {
      points: [{ text: `${title} sets out its scope and the decisions so far.`, cites: ['c1'] }],
    },
    sprint_pulse: {
      risk: 'on_track',
      headline: { text: `${title} is on track: nothing has waited unusually long.`, cites: ['c1'] },
      next: [],
    },
  };
  return { output: outputs[kind], citations: [cite], counts: { items: 1 } };
}
