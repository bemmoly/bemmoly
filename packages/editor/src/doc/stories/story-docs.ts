import type { RichTextDoc, RichTextNode } from '../../types.ts';
import cutover from './cutover.svg?no-inline';

/*
 * The Auth service RFC of the Doc Editor mock, as documents for the stories: each story
 * shows one node with the text the mock gives it, so the two can be read side by side.
 */

const text = (value: string, marks?: RichTextNode['marks']): RichTextNode => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
});
const p = (...content: RichTextNode[]): RichTextNode => ({ type: 'paragraph', content });
const h2 = (value: string): RichTextNode => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [text(value)],
});
const doc = (...content: RichTextNode[]): RichTextDoc => ({ type: 'doc', content });
const code = (value: string) => text(value, [{ type: 'code' }]);
const cell = (type: 'tableHeader' | 'tableCell', value: string): RichTextNode => ({
  type,
  attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
  content: [p(text(value))],
});

export const CALLOUT_DOC = doc(
  {
    type: 'callout',
    attrs: { variant: 'info' },
    content: [
      p(
        text(
          'Move sessions from Redis to Postgres behind a flag; dual-write, cut reads, keep Redis warm 7 days. Rollback is a flag flip. Open question: flag TTL (15 vs 30 min).',
        ),
      ),
    ],
  },
  ...(['note', 'success', 'warning', 'danger'] as const).map((variant) => ({
    type: 'callout',
    attrs: { variant },
    content: [
      p(
        text('If error rates exceed 0.5% after cutover, flip '),
        code('auth_pg_sessions'),
        text(' off.'),
      ),
    ],
  })),
);

export const MIGRATION_DOC = doc(h2('Migration order'), {
  type: 'orderedList',
  attrs: { start: 1, type: null },
  content: [
    ['Dual-write sessions to Redis and Postgres ', 'PLT-204'],
    ['Switch reads behind ', 'PLT-218', 'auth_pg_sessions'],
    ['Rate-limit the refresh endpoint before GA ', 'PLT-222'],
  ].map(([lead, key, flag]) => ({
    type: 'listItem',
    content: [
      p(text(lead!), ...(flag ? [code(flag), text(' ')] : []), {
        type: 'issueEmbed',
        attrs: { key },
      }),
    ],
  })),
});

export const DECISION_DOC = doc(
  {
    type: 'decision',
    attrs: { state: 'decided', decidedOn: '2026-10-07' },
    content: [
      p(
        text(
          'Sessions issued by the new service stay valid for 30 minutes, matching the flag TTL in code.',
        ),
      ),
    ],
  },
  {
    type: 'decision',
    attrs: { state: 'proposed', decidedOn: null },
    content: [p(text('Remove the legacy cookie path once the flag has been on for two weeks.'))],
  },
);

export const TOC_DOC = doc(
  { type: 'toc', attrs: { maxLevel: 3 } },
  h2('Context'),
  p(text('Sessions currently live in a Redis cluster with no durability guarantee.')),
  h2('Migration order'),
  { type: 'heading', attrs: { level: 3 }, content: [text('Dual-write')] },
  h2('Rollback'),
  h2('Open questions'),
);

export const TABLE_DOC = doc(h2('Owners'), {
  type: 'table',
  content: [
    ['tableHeader', 'Step', 'Owner', 'Issue'],
    ['tableCell', 'Dual-write sessions', 'Aisha K.', 'PLT-204'],
    ['tableCell', 'Switch reads', 'Priya N.', 'PLT-218'],
    ['tableCell', 'Rate-limit refresh', 'Jonas M.', 'PLT-222'],
  ].map(([type, ...values]) => ({
    type: 'tableRow',
    content: values.map((value) => cell(type as 'tableHeader' | 'tableCell', value!)),
  })),
});

export const CODE_DOC = doc({
  type: 'codeBlock',
  attrs: { language: 'go' },
  content: [
    text(
      '// Sessions stay valid for the flag TTL after a rollback.\nconst sessionTTL = 30 * time.Minute\n\nfunc enabled(flags Flags) bool {\n\treturn flags.Bool("auth_pg_sessions", false)\n}',
    ),
  ],
});

export const IMAGE_DOC = doc(
  {
    type: 'image',
    attrs: {
      src: cutover,
      alt: 'The session store cutover, step by step',
      title: null,
    },
  },
  { type: 'image', attrs: { src: '', alt: '', title: null } },
);

export const ISSUE_TABLE_DOC = doc(
  {
    type: 'issueTable',
    attrs: { query: 'project = PLT AND "spec doc" = this', title: 'Linked work' },
  },
  { type: 'issueTable', attrs: { query: '', title: '' } },
);

export const PAGE_LINK_DOC = doc(
  p(
    text('Evictions under memory pressure have logged users out twice this quarter (see '),
    { type: 'pageLink', attrs: { pageId: 'postmortem', title: 'Postmortem: Sep 29 login outage' } },
    text('). On-call follows the '),
    { type: 'pageLink', attrs: { pageId: 'runbook', title: 'Session migration runbook' } },
    text('.'),
  ),
  {
    type: 'unsupportedBlock',
    attrs: {
      source: 'confluence',
      name: 'jira-chart',
      raw: '<ac:structured-macro ac:name="jira-chart"/>',
    },
  },
);

export const OPEN_QUESTIONS_DOC = doc(h2('Open questions'), { type: 'paragraph' });
