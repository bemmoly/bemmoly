import type { AiAnswerSource } from '@bemmoly/shared/ai-answers';
import { uid } from './time.ts';
import { issueId } from './work-issues.ts';

/*
 * Canned "Ask your docs" answers over the Acme Labs seed, so the demo streams a believable,
 * cited answer with no model. Each answer cites the seeded pages and issues by the anchors
 * the read view prints; one sentence in the rollback answer is deliberately uncited so the
 * "Unsourced" marker shows. A question none of them match gets the honest empty answer.
 */

const page = (n: number) => ({ id: uid(n), path: `/docs/p/${uid(n)}` });
const PAGE_NOUN = { one: 'page', other: 'pages' };
const ISSUE_NOUN = { one: 'issue', other: 'issues' };

function pageSource(
  id: string,
  n: number,
  title: string,
  label: string,
  anchor?: string,
): AiAnswerSource {
  const target = page(n);
  return {
    id,
    kind: 'docs.page',
    targetId: target.id,
    title,
    href: anchor ? `${target.path}#${anchor}` : target.path,
    location: { label, part: 'body', ...(anchor ? { anchor } : {}) },
    noun: PAGE_NOUN,
  };
}

function issueSource(id: string, number: number, title: string): AiAnswerSource {
  return {
    id,
    kind: 'work.issue',
    targetId: issueId(number),
    title: `PLT-${number} ${title}`,
    href: `/work/issue/PLT-${number}`,
    location: { label: 'Description', part: 'description' },
    noun: ISSUE_NOUN,
  };
}

const RFC = 'RFC: Move sessions to Postgres';

export interface CannedAnswer {
  match: RegExp;
  sources: AiAnswerSource[];
  text: string;
}

export const CANNED_ANSWERS: readonly CannedAnswer[] = [
  {
    match: /\b(ttl|15 or 30|thirty|fifteen)\b/i,
    sources: [
      pageSource('c1', 5101, RFC, 'Rollback', 'rollback'),
      pageSource('c2', 5101, RFC, 'Open questions', 'open-questions'),
    ],
    text: [
      'The RFC says sessions issued by the new service stay valid for 15 minutes after the flag flips [c1].',
      'Its open questions note that the code says 30 minutes [c2].',
      'The two need to agree before the cutover.',
    ].join(' '),
  },
  {
    match: /roll ?back|cut ?over|auth_pg_sessions|revert/i,
    sources: [
      pageSource('c1', 5101, RFC, 'Rollback', 'rollback'),
      pageSource('c2', 5101, RFC, 'Backfill', 'backfill'),
      pageSource('c3', 5102, 'Auth service runbook', 'Auth service runbook'),
      issueSource('c4', 204, 'Session store migration to Postgres'),
    ],
    text: [
      'If error rates pass 0.5% after the cutover, flip auth_pg_sessions off [c1].',
      'Sessions from the new service stay valid for 15 minutes, so nobody is logged out [c1].',
      'Redis stays warm for 7 days, and on-call follows the auth service runbook [c1, c3].',
      '',
      '- Once the flag has been off for 24 hours with errors under 0.1%, re-run the backfill job [c2].',
      '- PLT-204 tracks the dual-write that makes the rollback a flag flip [c4].',
      '- Most teams flip the flag back within the hour.',
    ].join('\n'),
  },
  {
    match: /on-?call|escalat|latency|login/i,
    sources: [pageSource('c1', 5102, 'Auth service runbook', 'Auth service runbook')],
    text: 'When login latency climbs, on-call works through the auth service runbook [c1].',
  },
  {
    match: /postmortem|outage|checkout|incident/i,
    sources: [pageSource('c1', 5104, 'Postmortem: checkout outage', 'Postmortem: checkout outage')],
    text: 'Checkout failed for 38 minutes after a config push [c1].',
  },
  {
    match: /time off|leave|vacation|holiday/i,
    sources: [pageSource('c1', 5108, 'Time off', 'Time off')],
    text: 'The Time off page explains how to ask for leave and who approves it [c1].',
  },
];

export function cannedAnswer(question: string): CannedAnswer | null {
  return CANNED_ANSWERS.find((answer) => answer.match.test(question)) ?? null;
}
