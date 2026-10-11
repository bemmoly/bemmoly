/*
 * Page bodies for the dev mock, keyed by the page seed's number, so the doc editor opens on
 * a page that reads like the Doc Editor mock: sections, an ordered list with issue chips,
 * inline code and links. Pages without one get their one-line text as a paragraph.
 */

interface Node {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: Node[];
}

const text = (value: string, ...marks: Node['marks'] & object): Node =>
  marks.length ? { type: 'text', text: value, marks } : { type: 'text', text: value };
const code = (value: string) => text(value, { type: 'code' });
const link = (value: string, href: string) => text(value, { type: 'link', attrs: { href } });
const issue = (key: string): Node => ({ type: 'issueEmbed', attrs: { key } });
const p = (...content: Node[]): Node => ({ type: 'paragraph', content });
const h2 = (value: string): Node => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [text(value)],
});
const h3 = (value: string): Node => ({
  type: 'heading',
  attrs: { level: 3 },
  content: [text(value)],
});
const li = (...content: Node[]): Node => ({ type: 'listItem', content: [p(...content)] });

const RFC: Node = {
  type: 'doc',
  content: [
    h2('Context'),
    p(
      text(
        'We’re moving session handling out of the monolith into a standalone auth service. Sessions currently live in a Redis cluster with no durability guarantee; evictions under memory pressure have logged users out twice this quarter (see ',
      ),
      link('Postmortem: checkout outage', '/docs/p/018f0000-0000-7000-8000-0000000013f0'),
      text(').'),
    ),
    h2('Migration order'),
    {
      type: 'orderedList',
      attrs: { start: 1 },
      content: [
        li(text('Dual-write sessions to Redis and Postgres '), issue('PLT-204')),
        li(text('Switch reads behind '), code('auth_pg_sessions'), text(' '), issue('PLT-218')),
        li(text('Rate-limit the refresh endpoint before GA '), issue('PLT-222')),
        li(text('Remove the legacy cookie path')),
      ],
    },
    h2('Rollback'),
    p(
      text('If error rates exceed 0.5% after cutover, flip '),
      code('auth_pg_sessions'),
      text(
        ' off. Sessions issued by the new service stay valid for 15 minutes, so users aren’t logged out.',
      ),
    ),
    p(
      text('Redis stays warm for 7 days after cutover. On-call follows the '),
      link('Auth service runbook', '/docs/p/018f0000-0000-7000-8000-0000000013ee'),
      text('.'),
    ),
    h3('Backfill'),
    p(
      text(
        'Once the flag has been off for 24 hours with error rates back under 0.1%, re-run the backfill job to reconcile any sessions written only to Postgres.',
      ),
    ),
    h2('Open questions'),
    p(text('Flag TTL: 15 or 30 minutes? The code says 30.')),
  ],
};

export const DOCS_BODIES: Readonly<Record<number, Node>> = { 5101: RFC };
